import { build } from 'esbuild';
import path from 'path';

const isProd = process.argv.indexOf('--mode=production') >= 0;

console.log(
	'Building v2 support in',
	isProd ? 'production' : 'development',
	'mode',
);

// Node server
// https://esbuild.github.io/api
build({
	entryPoints: [path.join('./server/src/server.ts')],
	bundle: true,
	outfile: path.join('./server/dist/server.js'),
	external: ['vscode'],
	format: 'cjs',
	platform: 'node',
	minify: isProd,
	sourcemap: !isProd,
});

// Node client (not necessary for AHK++, but super fast)
// https://esbuild.github.io/api
build({
	entryPoints: [path.join('./client/src/extension.ts')],
	bundle: true,
	outfile: path.join('./client/dist/extension.js'),
	external: ['vscode'],
	format: 'cjs',
	platform: 'node',
	minify: isProd,
	sourcemap: !isProd,
});
