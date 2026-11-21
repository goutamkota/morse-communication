// Persisted user settings, shared by every screen. Same storage key as the vanilla app.
import { browser } from '$app/env';

const STORE_KEY = 'morse-light:v1';

export interface Settings {
	/** Morse unit (dot length) in ms. */
	unit: number;
	loop: boolean;
	vibrate: boolean;
}

const defaults: Settings = { unit: 200, loop: false, vibrate: true };

function load(): Settings {
	if (!browser) return { ...defaults };
	try {
		return { ...defaults, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') };
	} catch {
		return { ...defaults };
	}
}

export const settings = $state<Settings>(load());

export function saveSettings() {
	if (browser) localStorage.setItem(STORE_KEY, JSON.stringify(settings));
}
