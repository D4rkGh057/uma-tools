import * as esbuild from 'esbuild';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as http from 'node:http';
import { fileURLToPath } from 'node:url';

import { program, Option } from 'commander';

import { makeRedirectData, makeMockAssert } from './esbuild-plugins.mjs';

program
	.option('--debug')
	.addOption(new Option('--serve [port]', 'run development server on [port]').preset(8000).implies({debug: true}));

program.parse();
const options = program.opts();
const port = options.serve;
const serve = port != null;
const debug = !!options.debug;

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(dirname, '..', '..');
const datadir = path.join(dirname, '..', 'umalator-global');

const redirectData = makeRedirectData(datadir);
const mockAssert = makeMockAssert(debug);

const buildOptions = {
	entryPoints: [{in: 'app.tsx', out: 'bundle'}],
	bundle: true,
	minify: !debug,
	outdir: '.',
	write: !serve,
	define: {CC_DEBUG: debug.toString(), CC_GLOBAL: 'true'},
	external: ['*.ttf'],
	plugins: [redirectData, mockAssert]
};

const MIME_TYPES = {
	'.html': 'text/html; charset=UTF-8',
	'.css': 'text/css',
	'.js': 'text/javascript',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.otf': 'font/otf',
	'.ttf': 'font/ttf',
	'.woff': 'font/woff'
};

const ARTIFACTS = ['bundle.js', 'bundle.css'];

function runServer(ctx, port) {
	const requestCount = new Map(ARTIFACTS.map(f => [f, 0]));
	let buildCount = 0;
	let output = null;
	http.createServer(async (req, res) => {
		const url = req.url.endsWith('/') ? req.url + 'index.html' : req.url;
		const filename = path.basename(url);
		if (ARTIFACTS.indexOf(filename) > -1) {
			const requestN = requestCount.get(filename) + 1;
			requestCount.set(filename, requestN);
			if (requestN != buildCount) {
				buildCount += 1;
				console.log(`rebuilding ... => ${buildCount}`);
				output = new Promise(async resolve => {
					const result = await ctx.rebuild();
					resolve(new Map(result.outputFiles.map(o => [path.basename(o.path), o.contents])));
				});
			}
			console.log(`GET ${req.url} 200 OK => ${requestN}`);
			const artifact = (await output).get(filename);
			res.writeHead(200, {
				'Content-type': MIME_TYPES[path.extname(filename)],
				'Content-length': artifact.length
			}).end(artifact);
		} else {
			const fp = path.join(root, url);
			const exists = await fs.promises.access(fp).then(() => true, () => false);
			if (exists) {
				console.log(`GET ${req.url} 200 OK`);
				res.writeHead(200, {'Content-type': MIME_TYPES[path.extname(filename)] || 'application/octet-stream'});
				fs.createReadStream(fp).pipe(res);
			} else {
				console.log(`GET ${req.url} 404 Not Found`)
				res.writeHead(404).end();
			}
		}
	}).listen(port);
}

if (serve) {
	const ctx = await esbuild.context(buildOptions);
	runServer(ctx, port);
	console.log(`Serving on http://[::]:${port}/ ...`);
} else {
	await esbuild.build(buildOptions);
}
