const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const repoRoot = __dirname;
const { version } = require(path.join(repoRoot, 'package.json'));
const banner = fs
  .readFileSync(path.join(repoRoot, 'src/meta/header.ts'), 'utf8')
  .replace(/^export const USER_SCRIPT_HEADER = `|`;\s*$/g, '')
  .replace(/^(\/\/ @version\s+).*$/m, `$1${version}`);

esbuild.build({
  entryPoints: [path.join(repoRoot, 'src/main.ts')],
  outfile: path.join(repoRoot, 'RedeemHelper.user.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: false,
  banner: { js: banner }
}).catch(() => process.exit(1));
