// Small pieces of app-wide state shared between routes. Kept at module level so text
// survives switching tabs, as it does in the vanilla app.
import { cameraPermission } from '#lib/media/camera.ts';

/** Text in the Send box. Manual mode's "Reply via torch" writes here. */
export const draft = $state({ text: 'SOS' });

/** Text decoded by the camera receiver. */
export const received = $state({ text: '' });

/** Manual keyboard: committed letters (ch ' ' = word break) and the symbols being keyed. */
export const manual = $state({ entries: [] as { ch: string; code: string }[], buffer: '' });

/** Camera permission as last seen, drives the permission banner. */
export const permission = $state({ denied: false });

export async function refreshPermission() {
	permission.denied = (await cameraPermission()) === 'denied';
}
