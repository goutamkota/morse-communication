// Screen wake lock shared by sender and receiver. Held while anyone needs it.

const holders = new Set<string>();
let lock: WakeLockSentinel | null = null;
let pending = false;

export async function acquireWake(holder: string) {
	holders.add(holder);
	if (lock || pending || !('wakeLock' in navigator)) return;
	pending = true;
	try {
		const sentinel = await navigator.wakeLock.request('screen');
		// Everyone may have let go while the request was in flight.
		if (!holders.size) {
			sentinel.release().catch(() => {});
			return;
		}
		lock = sentinel;
		sentinel.addEventListener('release', () => {
			if (lock === sentinel) lock = null;
		});
	} catch {
		// Battery saver or unsupported; not critical.
	} finally {
		pending = false;
	}
}

export function releaseWake(holder: string) {
	holders.delete(holder);
	if (!holders.size && lock) {
		lock.release().catch(() => {});
		lock = null;
	}
}

/** The browser drops the lock when the page is hidden; take it back on return. */
export function reacquireWake() {
	const [first] = holders;
	if (first && !lock) acquireWake(first);
}
