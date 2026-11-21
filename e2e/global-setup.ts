import { DARK_CLIP, FLASH_CLIP, FLASH_TEXT, writeClip } from './fixtures.ts';

export default function globalSetup() {
	writeClip(FLASH_CLIP, FLASH_TEXT, 200);
	writeClip(DARK_CLIP, '');
}
