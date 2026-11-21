// App-shell service worker: every build file is precached under the build version and served
// cache-first; anything else goes to the network. A new version waits until the page asks it
// to take over (see src/lib/pwa/update.svelte.ts), so an open tab never loses its old chunks.
import { self as sw } from '$app/service-worker';
import { assets, immutable, prerendered } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `morse-light-${version}`;
// With relative paths, files are listed relative to the base, which is the worker's own directory.
const toUrl = (path: string) => new URL(path, sw.registration.scope).href;
const SCOPE = toUrl('./');
// Precache index.html by name: not every host maps a directory URL to its index file.
const SHELL = toUrl('index.html');
const ASSETS = new Set([
	SHELL,
	...[...immutable, ...assets, ...prerendered].map(({ path }) => toUrl(path))
]);

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...ASSETS])));
});

sw.addEventListener('message', (event) => {
	if (event.data === 'skip-waiting') sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k.startsWith('morse-light-') && k !== CACHE).map((k) => caches.delete(k))
				)
			)
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	url.search = '';
	url.hash = '';

	if (request.mode === 'navigate' && (url.href === SCOPE || url.href === SHELL)) {
		// Hash routing: every navigation inside the app is the shell. Network first so a
		// fresh deploy is picked up, cached shell when offline.
		event.respondWith(fetch(request).catch(async () => (await caches.match(SHELL)) ?? Response.error()));
		return;
	}
	if (url.origin !== sw.location.origin) return;
	// Look in every precache (a waiting new version may already hold the newer chunks);
	// nothing is added at runtime, so the caches never grow beyond the build.
	event.respondWith(caches.match(url.href).then((cached) => cached ?? fetch(request)));
});
