const AZURE_MODELS = new Set(['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-5']);

const GEMINI_FALLBACK_CHAIN = [
  'gemini-3.1-pro-preview',
  'gemini-3.5-flash',
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
];

export function isGemini(model: string): boolean {
  return model.toLowerCase().startsWith('gemini');
}

export function isAzure(model: string): boolean {
  return AZURE_MODELS.has(normalizeAzure(model));
}

export function normalizeAzure(model: string): string {
  const m = model.toLowerCase();
  switch (m) {
    case 'gpt4o':
      return 'gpt-4o';
    case 'gpt4omini':
      return 'gpt-4o-mini';
    case 'gpt35':
    case 'gpt-3.5':
      return 'gpt-3.5-turbo';
    case 'gpt5':
      return 'gpt-5';
    default:
      return model;
  }
}

export function normalizeGemini(model: string): string {
  const m = model.toLowerCase();
  switch (m) {
    case 'gemini-2.0-flash':
    case 'gemini-2.0-flash-001':
    case 'gemini-2.0-flash-lite':
    case 'gemini-2.0-flash-lite-001':
      return 'gemini-2.5-flash-lite';
    case 'gemini-3.1-pro':
    case 'gemini3.1pro':
    case 'gemini-3-pro':
    case 'gemini-3-pro-preview':
      return 'gemini-3.1-pro-preview';
    default:
      return model;
  }
}

export function getGeminiFallbackChain(
  primaryModel: string,
  allowFallback: boolean,
): string[] {
  const chain = [normalizeGemini(primaryModel)];
  if (!allowFallback) {
    return chain;
  }
  for (const fallback of GEMINI_FALLBACK_CHAIN) {
    if (!chain.some((m) => m.toLowerCase() === fallback.toLowerCase())) {
      chain.push(fallback);
    }
  }
  return chain;
}
