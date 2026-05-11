import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/modules/steam/settings.ts', import.meta.url), 'utf8');

test('reads selected key format from modal content scope', () => {
  assert.ok(
    source.includes("const selectedValue = content.querySelector<HTMLInputElement>('input[name=\"keyType\"]:checked')?.value;"),
    'showSwitchKey should read checked keyType from modal content instead of document'
  );
});
