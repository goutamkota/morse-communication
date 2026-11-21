// Post-build: make the hash-router shell use relative URLs.
//
// SvelteKit renders build/index.html as an SPA fallback without knowing its final location,
// so it emits root-absolute URLs ("/_app/…", "/service-worker.js"). With hash routing the
// shell always lives at the app root, so "./" is always correct — and the folder then works
// from any sub-path (GitHub Pages project sites) or a native web view.
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('../build/index.html', import.meta.url);
const before = readFileSync(file, 'utf8');
const after = before
	.replace(/(href|src)="\/(?!\/)/g, '$1="./')
	.replace(/import\("\/_app\//g, 'import("./_app/')
	.replace(/'\/service-worker\.js'/g, "'./service-worker.js'");

if (/(href|src)="\/[^/]|import\("\/|'\/service-worker/.test(after)) {
	console.error('relativize: root-absolute URLs left in build/index.html');
	process.exit(1);
}
writeFileSync(file, after);
console.log('relativize: build/index.html now uses relative URLs');
