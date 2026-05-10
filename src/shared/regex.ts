export const STEAM_KEY_RE = /\b(?:[A-Z0-9]{5}-){2,4}[A-Z0-9]{5}\b/gi;

export function extractSteamKeys(input: string): string[] {
  const matches = input.match(STEAM_KEY_RE) ?? [];
  return [...new Set(matches.map((key) => key.toUpperCase()))];
}
