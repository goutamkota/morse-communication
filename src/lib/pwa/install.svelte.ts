// "Install app" prompt (Chrome's beforeinstallprompt).

interface BeforeInstallPromptEvent extends Event {
	prompt(): Promise<void>;
	userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;

export const install = $state({ available: false });

/** Call once from the root layout; returns a cleanup function. */
export function listenForInstall(): () => void {
	const onPrompt = (e: Event) => {
		e.preventDefault();
		deferred = e as BeforeInstallPromptEvent;
		install.available = true;
	};
	const onInstalled = () => {
		deferred = null;
		install.available = false;
	};
	window.addEventListener('beforeinstallprompt', onPrompt);
	window.addEventListener('appinstalled', onInstalled);
	return () => {
		window.removeEventListener('beforeinstallprompt', onPrompt);
		window.removeEventListener('appinstalled', onInstalled);
	};
}

export async function promptInstall() {
	if (!deferred) return;
	await deferred.prompt();
	await deferred.userChoice;
	deferred = null;
	install.available = false;
}
