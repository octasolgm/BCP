export function toResponseMessage(text: string): string | Record<string, unknown> | unknown[] {
  const normalized = normalize(text);
  const parsed = tryParseJson(normalized);
  if (parsed !== null) {
    return parsed;
  }
  return normalized;
}

function normalize(text: string): string {
  let message = stripMarkdownCodeFence(text).trim();

  const formatted = tryFormatJsonString(message);
  if (formatted) {
    return formatted;
  }

  if (message.startsWith('"') && message.endsWith('"')) {
    try {
      const unquoted = JSON.parse(message) as string;
      if (unquoted?.trim()) {
        const inner = tryFormatJsonString(unquoted.trim());
        if (inner) {
          return inner;
        }
      }
    } catch {
      // keep message
    }
  }

  return message;
}

function stripMarkdownCodeFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith('```')) {
    return text;
  }
  const firstNewline = trimmed.indexOf('\n');
  if (firstNewline < 0) {
    return text;
  }
  let body = trimmed.slice(firstNewline + 1);
  if (body.endsWith('```')) {
    body = body.slice(0, -3);
  }
  return body.trim();
}

function tryFormatJsonString(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return null;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

function tryParseJson(text: string): Record<string, unknown> | unknown[] | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as Record<string, unknown> | unknown[];
  } catch {
    return null;
  }
}
