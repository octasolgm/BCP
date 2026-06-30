/**
 * Audit all comparable gov points against cached compare results (0 Landing AI credits).
 * Usage: node apps/api/scripts/audit-compare-all.mjs [--granularity=leaf|section]
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const API = process.env.API_BASE || 'http://localhost:4000';
const GOV_HASH =
  'c84713f9aacd18415680356aeae47bcacff9c17458b5595b575400b12fe8f2ff';
const INTERNAL_HASH =
  '6a0a0bd13c7a32ea10c43c9a8391347a7e0caceaa0b17dd6443e9ee622111717';

const granularity =
  process.argv.find((a) => a.startsWith('--granularity='))?.split('=')[1] ||
  'leaf';

const GENERIC_CAP = [
  /one or more sub-conditions/i,
  /review the requirement against internal procedures/i,
  /not fully documented in the internal policy evidence cited above/i,
];

function isGenericCap(cap) {
  if (!cap?.trim()) return true;
  return GENERIC_CAP.some((p) => p.test(cap));
}

function hasCap(cap) {
  const v = cap?.trim();
  return Boolean(v && v !== 'N/A' && v !== '—' && v !== '-');
}

async function loadGovPoints() {
  const seedPath = join(
    __dirname,
    '../src/modules/landing-ai/seed-data/gov-tfs-guidelines.extract.json',
  );
  const seed = JSON.parse(readFileSync(seedPath, 'utf-8'));
  const points = seed.extraction?.points ?? seed.points ?? [];
  return points.filter((p) => p?.point_id && p?.text);
}

async function comparePoint(point) {
  const form = new FormData();
  form.append('point', JSON.stringify(point));
  form.append('internalFileName', 'I M P T F S.pdf');
  form.append('internalFileHash', INTERNAL_HASH);

  const res = await fetch(`${API}/landing-ai/compare-point`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || JSON.stringify(data));
  }
  return data;
}

function classifyIssue(pointId, c) {
  const issues = [];
  const status = c.status?.trim() || '';
  const cap = c.corrective_action?.trim() || '';

  if (status === 'Compliant' && hasCap(cap)) {
    issues.push('Compliant but has CAP');
  }
  if (status === 'Compliant' && c.confidence === 100 && hasCap(cap)) {
    issues.push('100% Compliant with CAP');
  }
  if (
    (status === 'Partial Compliant' || status === 'Non-Compliant') &&
    !hasCap(cap)
  ) {
    issues.push('Partial/Non-Compliant missing CAP');
  }
  if (
    (status === 'Partial Compliant' || status === 'Non-Compliant') &&
    isGenericCap(cap)
  ) {
    issues.push('Generic/vague CAP (no specific gap named)');
  }
  if (
    (status === 'Partial Compliant' || status === 'Non-Compliant') &&
    !c.responsibility?.trim()
  ) {
    issues.push('Missing responsibility');
  }
  if (/^(Compliant|Partial Compliant|Non-Compliant)\s*:/i.test(c.output_response || '')) {
    issues.push('Status prefix in evidence field');
  }

  return issues.map((i) => ({ pointId, issue: i, status, cap: cap.slice(0, 120) }));
}

async function main() {
  console.log(`Auditing compare results (${granularity}) via ${API}…\n`);

  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error('API not reachable');

  let allPoints = await loadGovPoints();
  console.log(`Loaded ${allPoints.length} raw gov points from seed`);

  // Filter §1 skip + informational (simplified)
  allPoints = allPoints.filter((p) => {
    const id = p.point_id.trim();
    if (/^1(\.|$)/.test(id) || /^1\.\d/.test(id)) return false;
    if (/^2\.$/.test(id)) return false;
    if (/^[A-Za-z].* - /.test(id)) return false;
    return true;
  });

  if (granularity === 'section') {
    // Keep section headers 2.1, 2.2 or rolled - use points without parent skip
    const ids = new Set(allPoints.map((p) => p.point_id));
    allPoints = allPoints.filter((p) => {
      const id = p.point_id.trim();
      const isParent = /^\d+\.\d+\.?$/.test(id) && !/^\d+\.\d+\.\d+/.test(id);
      if (isParent) {
        const prefix = id.replace(/\.$/, '') + '.';
        const hasChildren = [...ids].some(
          (other) => other !== id && other.startsWith(prefix),
        );
        return hasChildren;
      }
      // leaf-only sections without children
      return /^\d+\.\d+\.?$/.test(id);
    });
  } else {
    // leaf: skip section parents that have children
    const ids = allPoints.map((p) => p.point_id);
    allPoints = allPoints.filter((p) => {
      const id = p.point_id.trim();
      const norm = id.replace(/\.$/, '');
      const prefix = `${norm}.`;
      const hasChildren = ids.some(
        (other) => other !== id && other.replace(/\.$/, '').startsWith(prefix),
      );
      if (hasChildren && /^\d+\.\d+(\.\d+)*\.?$/.test(id)) return false;
      return /^\d+\.\d+\.\d+/.test(id) || (/^\d+\.\d+\.?$/.test(id) && !hasChildren);
    });
  }

  allPoints.sort((a, b) => a.point_id.localeCompare(b.point_id, undefined, { numeric: true }));
  console.log(`Comparable ${granularity} points: ${allPoints.length}\n`);

  const summary = { Compliant: 0, 'Partial Compliant': 0, 'Non-Compliant': 0, missing: 0, issues: [] };
  const rows = [];

  for (const point of allPoints) {
    try {
      const data = await comparePoint(point);
      const c = data.comparison;
      if (!c) {
        summary.missing++;
        rows.push({ id: point.point_id, status: 'NO CACHE', confidence: '-', issues: ['No compare cache — run Compare all'] });
        continue;
      }
      const status = c.status?.trim() || 'Unknown';
      if (summary[status] !== undefined) summary[status]++;
      const pointIssues = classifyIssue(point.point_id, c);
      summary.issues.push(...pointIssues);
      rows.push({
        id: point.point_id,
        status,
        confidence: c.confidence,
        cap: c.corrective_action?.slice(0, 80) || '—',
        issues: pointIssues.map((i) => i.issue),
        cached: data.cached,
      });
    } catch (e) {
      rows.push({ id: point.point_id, status: 'ERROR', confidence: '-', issues: [e.message] });
    }
  }

  console.log('--- Status summary ---');
  console.log(`Compliant:         ${summary.Compliant}`);
  console.log(`Partial Compliant: ${summary['Partial Compliant']}`);
  console.log(`Non-Compliant:     ${summary['Non-Compliant']}`);
  console.log(`No cache:          ${summary.missing}`);
  console.log(`Logic issues:      ${summary.issues.length}`);

  if (summary.issues.length) {
    console.log('\n--- Logic issues ---');
    for (const i of summary.issues) {
      console.log(`  ${i.pointId}: ${i.issue}`);
    }
  }

  const genericCaps = rows.filter((r) =>
    r.issues?.some((x) => x.includes('Generic/vague CAP')),
  );
  if (genericCaps.length) {
    console.log('\n--- Generic CAP points (re-run Compare all with forceCompare) ---');
    for (const r of genericCaps) {
      console.log(`  ${r.id}: ${r.cap}`);
    }
  }

  const noCache = rows.filter((r) => r.status === 'NO CACHE');
  if (noCache.length) {
    console.log('\n--- Missing compare cache ---');
    console.log(noCache.map((r) => r.id).join(', '));
  }

  console.log('\n--- Sample: 2.4.x ---');
  for (const r of rows.filter((r) => r.id.startsWith('2.4'))) {
    console.log(`  ${r.id} | ${r.status} ${r.confidence}% | issues: ${r.issues?.join(', ') || 'none'}`);
    if (r.cap && r.cap !== '—') console.log(`    CAP: ${r.cap}…`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
