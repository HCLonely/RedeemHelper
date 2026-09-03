import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/modules/itch/linkage.ts', 'utf8');
const itchSource = readFileSync('src/modules/itch/index.ts', 'utf8');
const redeemSource = readFileSync('src/modules/itch/redeem.ts', 'utf8');
assert.match(source, /GM_getValue/);
assert.match(source, /GM_setValue/);
assert.match(source, /unsafeWindow\[.*linkageCode.*\]/);
assert.match(source, /connected/);
assert.match(source, /removeOwned/);
assert.match(itchSource, /import \{ getItchLinkage \} from '\.\/linkage';/);
assert.match(itchSource, /export function initItch\(\): void \{[\s\S]*?getItchLinkage\(\);/);
assert.match(redeemSource, /isItchOwned\(url\)/);
assert.match(redeemSource, /updateItchLinkage\(\)/);
assert.match(redeemSource, /skipLinkedOwnershipCheck/);
assert.match(redeemSource, /deferLinkageUpdate/);
