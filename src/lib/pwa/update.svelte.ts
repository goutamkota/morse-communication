// "New version available" flow. The service worker waits after installing; the user
// chooses when to switch, so an open session never loses the chunks it was loaded with.

export const update = $state({ available: false });

let waiting: ServiceWorker | null = null;

/** Call once from the root layout; returns a cleanup function. */
export function watchForUpdate(): () => void {
	if (!('serviceWorker' in navigator)) return () => {};
	let reg: ServiceWorkerRegistration | undefined;

	const offer = (worker: ServiceWorker | null) => {
		// Only an *update*: the very first install has no controller to replace.
		if (!worker || !navigator.serviceWorker.controller) return;
		waiting = worker;
		update.available = true;
	};
	const onFound = () => {
		const worker = reg?.installing;
		worker?.addEventListener('statechange', () => worker.state === 'installed' && offer(worker));
	};
	let reloading = false;
	const onControllerChange = () => {
		if (waiting && !reloading) {
			reloading = true;
			location.reload();
		}
	};

	navigator.serviceWorker.getRegistration().then((r) => {
		reg = r;
		if (!r) return;
		offer(r.waiting);
		r.addEventListener('updatefound', onFound);
	});
	navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
	return () => {
		reg?.removeEventListener('updatefound', onFound);
		navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
	};
}

export function applyUpdate() {
	waiting?.postMessage('skip-waiting');
}
