import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

const source = readFileSync('src/modules/itch/linkage.ts', 'utf8');
const itchSource = readFileSync('src/modules/itch/index.ts', 'utf8');
const redeemSource = readFileSync('src/modules/itch/redeem.ts', 'utf8');
const extractSource = readFileSync('src/modules/itch/extract.ts', 'utf8');
const bundleSource = readFileSync('src/modules/itch/bundle.ts', 'utf8');
const autoConsoleSource = readFileSync('src/modules/itch/autoConsole.ts', 'utf8');
assert.match(source, /GM_getValue/);
assert.match(source, /GM_setValue/);
assert.match(source, /unsafeWindow\[.*linkageCode.*\]/);
assert.match(source, /import \{ showModal \} from '\.\.\/\.\.\/shared\/ui';/);
assert.doesNotMatch(source, /\bSwal\.fire\b/);
assert.match(source, /connected/);
assert.match(source, /removeOwned/);
assert.match(source, /try \{[\s\S]*?linkage\.removeOwned\(\[\.\.\.games\]\.map/);
assert.match(source, /Array\.isArray\(unownedGames\)/);
assert.match(source, /try \{[\s\S]*?linkage\.has\(game\.match[\s\S]*?catch/);
assert.match(source, /try \{[\s\S]*?linkage\.update\(\)[\s\S]*?catch/);
assert.match(itchSource, /import \{ getItchLinkage \} from '\.\/linkage';/);
assert.match(itchSource, /export function initItch\(\): void \{[\s\S]*?getItchLinkage\(\);/);
assert.match(redeemSource, /isItchOwned\(url\)/);
assert.match(redeemSource, /updateItchLinkage\(\)/);
assert.match(redeemSource, /skipLinkedOwnershipCheck/);
assert.match(redeemSource, /deferLinkageUpdate/);
assert.match(extractSource, /removeOwnedItchGames\(games\)/);
assert.match(bundleSource, /removeOwnedItchGames\(games\)/);
assert.match(extractSource, /completed % 30 === 0/);
assert.match(extractSource, /updateItchLinkage\(\)/);
const finalUpdateGuard = /originalTotal <= 50 \|\| completed === 0 \|\| completed % 30 !== 0/;
assert.match(extractSource, finalUpdateGuard);
assert.equal(bundleSource.match(new RegExp(finalUpdateGuard.source, 'g'))?.length, 2);
assert.match(extractSource, /onPrepared\?\.\(unownedGames\.length, originalTotal - unownedGames\.length\)/);
assert.match(autoConsoleSource, /本轮待入库/);
assert.match(autoConsoleSource, /实际需入库 \$\{remaining\} 个/);

const compiled = await build({
  entryPoints: ['src/modules/itch/linkage.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: ['node20'],
  write: false,
  logLevel: 'silent',
  plugins: [{
    name: 'stub-linkage-ui',
    setup(esbuild) {
      esbuild.onResolve({ filter: /shared\/ui$/ }, () => ({ path: 'linkage-ui', namespace: 'test' }));
      esbuild.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
        contents: 'export const showModal = (options) => globalThis.__showLinkageModal(options);',
        loader: 'js'
      }));
    }
  }]
});

const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`;
const linkageModule = await import(moduleUrl);

let savedCode = ' savedCode ';
let savedWrite = null;
const modalCalls = [];
let inputFocused = false;
let inputSelected = false;

globalThis.GM_getValue = (_key, fallback) => savedCode ?? fallback;
globalThis.GM_setValue = (key, value) => {
  savedWrite = { key, value };
  savedCode = value;
};
globalThis.unsafeWindow = {};
globalThis.document = {
  createElement(tagName) {
    assert.equal(tagName, 'input');
    const attributes = {};
    return {
      type: '',
      value: '',
      placeholder: '',
      autocomplete: '',
      setAttribute(name, value) { attributes[name] = value; },
      getAttribute(name) { return attributes[name]; },
      focus() { inputFocused = true; },
      select() { inputSelected = true; }
    };
  }
};
globalThis.__showLinkageModal = async (options) => {
  modalCalls.push(options);
  if (modalCalls.length === 1) {
    assert.equal(options.title, '输入Itch联动码');
    assert.equal(options.content.value, 'savedCode');
    assert.equal(options.content.getAttribute('aria-label'), 'Itch联动码');
    options.content.value = '  newCode  ';
  }
  return true;
};

await linkageModule.setItchLinkageCode();
assert.deepEqual(savedWrite, { key: 'itchLinkageCode', value: 'newCode' });
assert.equal(inputFocused, true);
assert.equal(inputSelected, true);
assert.equal(modalCalls[1].title, 'Itch联动码不可用');
assert.equal(modalCalls[1].icon, 'error');

savedCode = 'keepCode';
savedWrite = null;
globalThis.__showLinkageModal = async (options) => {
  assert.equal(options.content.value, 'keepCode');
  options.content.value = 'discardedCode';
  return null;
};
await linkageModule.setItchLinkageCode();
assert.equal(savedWrite, null);
assert.equal(savedCode, 'keepCode');

const requiredMethods = {
  get() {},
  add() {},
  removeOwned(games) { return games; }
};
const originalWarn = console.warn;
console.warn = () => {};

try {
  savedCode = 'linkage';
  globalThis.unsafeWindow.linkage = Object.assign(() => undefined, {
    connected: true,
    ...requiredMethods,
    has: () => { throw new Error('has unavailable'); },
    update: () => { throw new Error('update unavailable'); }
  });

  assert.equal(await linkageModule.isItchOwned('https://example.itch.io/game'), false);
  await assert.doesNotReject(() => linkageModule.updateItchLinkage());
  globalThis.unsafeWindow.linkage.has = () => Promise.reject(new Error('has rejected'));
  globalThis.unsafeWindow.linkage.update = () => Promise.reject(new Error('update rejected'));
  assert.equal(await linkageModule.isItchOwned('https://example.itch.io/game'), false);
  await assert.doesNotReject(() => linkageModule.updateItchLinkage());

  globalThis.unsafeWindow.linkage.has = async () => true;
  globalThis.unsafeWindow.linkage.update = async () => undefined;
  globalThis.unsafeWindow.linkage.removeOwned = async () => ['unowned'];
  assert.equal(await linkageModule.isItchOwned('https://example.itch.io/game'), true);
  assert.deepEqual(await linkageModule.removeOwnedItchGames(['owned', 'unowned']), ['https://unowned']);

  globalThis.unsafeWindow.linkage.removeOwned = async () => ({ malformed: true });
  assert.deepEqual(await linkageModule.removeOwnedItchGames(['owned', 'unowned']), ['owned', 'unowned']);

  globalThis.unsafeWindow.linkage.removeOwned = async () => { throw new Error('removeOwned unavailable'); };
  assert.deepEqual(await linkageModule.removeOwnedItchGames(['owned', 'unowned']), ['owned', 'unowned']);
} finally {
  console.warn = originalWarn;
  delete globalThis.GM_getValue;
  delete globalThis.GM_setValue;
  delete globalThis.unsafeWindow;
  delete globalThis.document;
  delete globalThis.__showLinkageModal;
}
