// Minimal static server for the finished `build/` folder — exactly what a static host serves.
// Usage: node scripts/serve.js [port] [base]   e.g. `node scripts/serve.js 4173 /morse/` to
// mimic a GitHub Pages project sub-path.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../build/', import.meta.url));
const port = Number(process.argv[2] ?? 4173);
const base = process.argv[3] ?? '/';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.txt': 'text/plain; charset=utf-8'
};

createServer(async (req, res) => {
	const { pathname } = new URL(req.url ?? '/', 'http://x');
	if (!pathname.startsWith(base)) {
		res.writeHead(404).end('Not found');
		return;
	}
	let rel;
	try {
		rel = decodeURIComponent(pathname.slice(base.length));
	} catch {
		res.writeHead(400).end('Bad request');
		return;
	}
	let file = normalize(join(root, rel));
	if (!file.startsWith(root)) {
		res.writeHead(403).end();
		return;
	}
	try {
		if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
		const body = await readFile(file);
		res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
		res.end(body);
	} catch {
		res.writeHead(404).end('Not found');
	}
}).listen(port, () => console.log(`Serving build/ at http://localhost:${port}${base}`));
