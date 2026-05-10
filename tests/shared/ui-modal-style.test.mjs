import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';

const source = readFileSync(new URL('../../src/shared/ui.ts', import.meta.url), 'utf8');
const { code } = transformSync(source, {
  loader: 'ts',
  format: 'esm',
  target: 'es2020'
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);

test('exports semantic helper functions', () => {
  assert.equal(typeof mod.getModalToneClass, 'function');
  assert.equal(typeof mod.getButtonRoleClass, 'function');
  assert.equal(typeof mod.MODAL_STYLES, 'string');
});

test('maps icon to semantic tone class', () => {
  assert.equal(mod.getModalToneClass('success'), 'rh-modal--success');
  assert.equal(mod.getModalToneClass('error'), 'rh-modal--error');
  assert.equal(mod.getModalToneClass('warning'), 'rh-modal--warning');
  assert.equal(mod.getModalToneClass('info'), 'rh-modal--info');
  assert.equal(mod.getModalToneClass(undefined), '');
});

test('maps button keys to role classes', () => {
  assert.equal(mod.getButtonRoleClass('confirm', 'success'), 'rh-modal-button--primary');
  assert.equal(mod.getButtonRoleClass('confirm', 'error'), 'rh-modal-button--danger');
  assert.equal(mod.getButtonRoleClass('cancel', 'warning'), 'rh-modal-button--secondary');
  assert.equal(mod.getButtonRoleClass('back', 'info'), 'rh-modal-button--secondary');
  assert.equal(mod.getButtonRoleClass('custom', 'info'), 'rh-modal-button--secondary');
});

test('keeps danger role policy regression coverage', () => {
  assert.equal(mod.getButtonRoleClass('confirm', 'error'), 'rh-modal-button--danger');
  assert.equal(mod.getButtonRoleClass('confirm', 'warning'), 'rh-modal-button--primary');
  assert.equal(mod.getButtonRoleClass('cancel', 'error'), 'rh-modal-button--secondary');
});

test('renderModal wires semantic tone and button role classes', () => {
  assert.match(source, /const toneClass = getModalToneClass\(opts\.icon\);/);
  assert.match(source, /const tone = getModalTone\(opts\.icon\);/);
  assert.match(source, /activeModal\.modal\.className = `rh-modal\$\{opts\.className \? ` \$\{opts\.className\}` : ''\}\$\{toneClass \? ` \$\{toneClass\}` : ''\}`;/);
  assert.match(source, /button\.className = `rh-modal-button \$\{getButtonRoleClass\(key, tone\)\}`;/);
});

test('keeps style contract for modern compact-balanced design', () => {
  assert.match(mod.MODAL_STYLES, /width:\s*min\(92vw,\s*460px\)/);
  assert.match(mod.MODAL_STYLES, /max-height:\s*85vh/);
  assert.match(mod.MODAL_STYLES, /padding:\s*20px/);
  assert.match(mod.MODAL_STYLES, /border-radius:\s*12px/);
  assert.match(mod.MODAL_STYLES, /rgba\(17,\s*24,\s*39,\s*0\.5\)/);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-title\s*\{[\s\S]*font-size:\s*18px;[\s\S]*font-weight:\s*600;/);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-text,[\s\S]*line-height:\s*1\.6;/);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-text,[\s\S]*font-size:\s*14px;/);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-content input:not\(\[type\]\),[\s\S]*\.rh-modal-content input\[type="text"\],[\s\S]*\.rh-modal-content textarea/);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-content input:not\(\[type\]\),[\s\S]*border:\s*1px\s+solid\s+#d1d5db;/);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-content input:not\(\[type\]\),[\s\S]*border-radius:\s*8px;/);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-content input:not\(\[type\]\),[\s\S]*?(?:^|[\s;])width:\s*100%;/m);
  assert.match(mod.MODAL_STYLES, /\.rh-modal-content input:not\(\[type\]\):focus,[\s\S]*\.rh-modal-content textarea:focus,[\s\S]*outline:\s*2px\s+solid\s+#93c5fd;/);
  assert.ok(!/transition\s*:|animation\s*:/.test(mod.MODAL_STYLES));
});
