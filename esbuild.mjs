import { build, context } from 'esbuild';

/** @type {import('esbuild').BuildOptions} */
const server_opt = {
	define: {
		'process.env.BROWSER': 'false',
		'process.env.DEBUG': 'false',
	},
	entryPoints: ['server/src/server.ts', 'server/src/test/*.ts'],
	format: 'cjs',
	logLevel: 'error',
	outbase: 'server/src',
	outdir: 'server/dist',
	platform: 'node',
	sourcemap: true,
};
const client_opt = {
	...server_opt,
	entryPoints: ['client/src/extension.ts', 'client/src/test/*.ts'],
	outbase: 'client/src',
	outdir: 'client/dist',
};

switch (process.argv[2]) {
	case '--cli': build_cli(); break;
	case '--dev': build_watch(); break;
	case '--web': build_watch(true); break;
	default: build_prod(); break;
}

async function build_cli() {
	server_opt.bundle = true;
	server_opt.minify = true;
	server_opt.entryPoints = ['server/cli/*.ts'];
	server_opt.outbase = 'server/cli';
	server_opt.outdir = 'server/cli';
	server_opt.sourcemap = false;
	const start = new Date;
	await build(server_opt);
	console.log(`build finished in ${new Date - start} ms`);
}

async function build_prod() {
	const opts = [
		client_opt, server_opt,
		{ ...client_opt, entryPoints: client_opt.entryPoints.splice(1) },
		{ ...server_opt, entryPoints: ['server/src/**/*.ts'], outdir: 'server/out' },
	];
	client_opt.external = ['vscode'];
	client_opt.bundle = server_opt.bundle = true;
	client_opt.minify = server_opt.minify = true;
	server_opt.entryPoints.splice(1);
	opts.push(...browser_opts(true));
	const start = new Date;
	await Promise.all(opts.map(o => build(o)));
	console.log(`build finished in ${new Date - start} ms`);
}

function build_watch(web = false) {
	let start, timer, opts;
	/** @type {import('esbuild').Plugin} */
	const plugin = {
		name: 'esbuild-problem-matcher',
		setup(build) {
			build.onStart(() => {
				start ??= (console.log('\x1bc[watch] build started'), new Date);
			});
			build.onEnd(result => {
				const end = new Date;
				result.errors.forEach(({ text, location }) => {
					console.error(`✘ [ERROR] ${text}`);
					console.error(`    ${location.file}:${location.line}:${location.column}:`);
				});
				timer && clearTimeout(timer);
				timer = setTimeout(() => {
					console.log(`[watch] build finished in ${end - start} ms`);
					start = timer = undefined;
				}, 500);
			});
		}
	};
	client_opt.logLevel = server_opt.logLevel = 'silent';
	server_opt.define['process.env.DEBUG'] = 'true';
	if (web)
		opts = browser_opts(false);
	else {
		client_opt.entryPoints = ['client/src/**/*.ts'];
		server_opt.entryPoints = ['server/src/**/*.ts'];
		server_opt.outdir = 'server/out';
		opts = [client_opt, server_opt];
	}
	for (const opt of opts) {
		opt.plugins = [plugin];
		context(opt).then(ctx => ctx.watch());
	}
}
/** @returns {Array<import('esbuild').BuildOptions>} */
function browser_opts(minify) {
	const browser_opt = {
		bundle: true,
		define: {
			...server_opt.define,
			'process.cwd': 'process_cwd',
			'process.env.BROWSER': 'true',
		},
		minify,
		platform: 'browser',
	};
	return [{
		...client_opt,
		...browser_opt,
		entryPoints: ['client/src/browserClientMain.ts'],
		external: ['vscode'],
	}, {
		...server_opt,
		...browser_opt,
		entryPoints: ['server/src/browserServerMain.ts'],
		footer: {
			js: 'function process_cwd(){return""}'
		},
	}];
}