const esbuild = require('esbuild');
const fs = require('fs');

const banner = fs.readFileSync('./src/meta/header.ts', 'utf8').replace(/^export const USER_SCRIPT_HEADER = `|`;$/g, '');

esbuild.build({
  entryPoints: ['./src/main.ts'],
  outfile: './RedeemHelper.user.js',
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  charset: 'utf8',
  legalComments: 'none',
  sourcemap: false,
  banner: { js: banner }
}).catch(() => process.exit(1));
