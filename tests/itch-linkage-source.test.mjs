import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/modules/itch/linkage.ts', 'utf8');
assert.match(source, /GM_getValue/);
assert.match(source, /GM_setValue/);
assert.match(source, /unsafeWindow\[.*linkageCode.*\]/);
assert.match(source, /connected/);
assert.match(source, /removeOwned/);
