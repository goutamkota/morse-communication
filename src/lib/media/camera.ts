// Camera helpers: secure-context check, permission state, rear camera with torch.

type TorchCapabilities = MediaTrackCapabilities & {
	torch?: boolean;
	exposureCompensation?: { min: number; max: number };
	whiteBalanceMode?: string[];
};

export function cameraSupported(): boolean {
	return !!(window.isSecureContext && navigator.mediaDevices?.getUserMedia);
}

export type PermissionStateOrUnknown = PermissionState | 'unknown';

export async function cameraPermission(): Promise<PermissionStateOrUnknown> {
	try {
		const status = await navigator.permissions.query({ name: 'camera' as PermissionName });
		return status.state;
	} catch {
		return 'unknown';
	}
}

export function describeError(err: unknown): string {
	const e = err as { name?: string; message?: string } | undefined;
	switch (e?.name) {
		case 'NotAllowedError':
		case 'SecurityError':
			return 'Camera permission was denied. Tap the lock icon in the address bar → Permissions → Camera → Allow, then try again.';
		case 'NotFoundError':
		case 'OverconstrainedError':
			return 'No suitable rear camera was found on this device.';
		case 'NotReadableError':
		case 'AbortError':
			return 'The camera is busy. Close other apps or tabs using the camera and try again.';
		case 'InsecureContext':
			return 'Camera access needs HTTPS. Open this app from its https:// address.';
		default:
			return `Could not start the camera${e?.message ? `: ${e.message}` : '.'}`;
	}
}

function insecureError() {
	const e = new Error('Insecure context');
	e.name = 'InsecureContext';
	return e;
}

export async function openRearCamera(extra: MediaTrackConstraints = {}): Promise<MediaStream> {
	if (!cameraSupported()) throw insecureError();
	return navigator.mediaDevices.getUserMedia({
		audio: false,
		video: { facingMode: { ideal: 'environment' }, ...extra }
	});
}

function capabilities(track: MediaStreamTrack): TorchCapabilities {
	try {
		return (track.getCapabilities?.() ?? {}) as TorchCapabilities;
	} catch {
		return {};
	}
}

export function stopStream(stream: MediaStream | null | undefined) {
	stream?.getTracks().forEach((t) => t.stop());
}

function rearScore(label = ''): number {
	const l = label.toLowerCase();
	if (/front|user|selfie/.test(l)) return -1;
	if (/back|rear|environment/.test(l)) return 1;
	return 0;
}

export interface TorchHandle {
	stream: MediaStream | null;
	track: MediaStreamTrack | null;
}

/**
 * Finds a rear camera whose track exposes the torch. Some phones have several rear
 * cameras and only one controls the flash, so each is tried in turn.
 * Resolves to nulls when no torch exists.
 */
export async function openTorch(): Promise<TorchHandle> {
	const first = await openRearCamera({ width: { ideal: 640 }, height: { ideal: 480 } });
	const firstTrack = first.getVideoTracks()[0];
	if (capabilities(firstTrack).torch) return { stream: first, track: firstTrack };
	const firstId = firstTrack.getSettings().deviceId;
	stopStream(first);

	const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
		(d) => d.kind === 'videoinput' && d.deviceId !== firstId && rearScore(d.label) >= 0
	);
	// Labels are available once permission has been granted; prefer ones that look like rear cameras.
	devices.sort((a, b) => rearScore(b.label) - rearScore(a.label));
	for (const device of devices) {
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: { deviceId: { exact: device.deviceId } }
			});
		} catch {
			continue;
		}
		const track = stream.getVideoTracks()[0];
		if (capabilities(track).torch) return { stream, track };
		stopStream(stream);
	}
	return { stream: null, track: null };
}

export async function setTorch(track: MediaStreamTrack, on: boolean) {
	await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] });
}

/** Best effort: stop auto-exposure from dimming the image when the flash appears. */
export async function tameExposure(track: MediaStreamTrack) {
	const caps = capabilities(track);
	const advanced: Record<string, unknown> = {};
	if (caps.exposureCompensation) advanced.exposureCompensation = caps.exposureCompensation.min;
	if (caps.whiteBalanceMode?.includes('manual')) advanced.whiteBalanceMode = 'manual';
	if (!Object.keys(advanced).length) return;
	try {
		await track.applyConstraints({ advanced: [advanced as MediaTrackConstraintSet] });
	} catch {
		// Not supported on this device; auto exposure stays on.
	}
}
