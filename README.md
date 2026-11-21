# Morse Light — SvelteKit PWA

Two-way Morse code between two phones using light. This is the SvelteKit 3 / Svelte 5 port of
`../VanilaJs App/`, with the same behaviour.

- **Send**: type text and the rear torch flashes it in ITU timing. Phones without a controllable
  torch flash the whole screen instead.
- **Receive**: the rear camera watches the other phone's light and decodes it live. It adapts to
  the sender's speed. If it can't see the flashes, it offers **Switch to Manual**.
- **Manual**: an on-screen Morse keyboard (· – letter gap, space, ⌫, A–Z grid) with vibration.
  The system keyboard never opens. "Reply via torch" sends what you typed back.

## Commands

```sh
npm install
npm run dev         # dev server (http://localhost:5173, camera works on localhost)
npm run check       # svelte-check + TypeScript
npm run test:unit   # Vitest: Morse table, decoder, light detector
npm run test:e2e    # Playwright: builds, serves build/ under /morse/, fake camera clips
npm run build       # static site in build/
npm run preview     # serve build/ at http://localhost:4173
```

## Hosting

`build/` is a plain static folder with no server logic and no rewrite rules:

- Routing uses the URL hash (`#/receive`), so deep links work anywhere.
- All URLs are relative, so the app also works from a sub-path such as
  `https://you.github.io/morse/`. `scripts/relativize.js` handles this after `vite build`.

Upload `build/` to any **HTTPS** host, for example GitHub Pages, Netlify (drag and drop),
Cloudflare Pages, Vercel or S3 + CloudFront. HTTPS is required for the camera, the torch and
installing the app; `localhost` is the only exception.

## Testing on two phones

1. Open the hosted URL in Chrome on Android on both phones and tap **Install** (or use the menu →
   Add to Home screen).
2. **Phone A → Send**: type `SOS TEST` and tap **Start sending**. Allow camera access; the torch
   is reached through the camera API.
3. **Phone B → Receive**: tap **Start camera** and point it at phone A from 0.5–2 m away. Tap the
   image to put the target box on A's torch. A dim room works best.
4. Watch the graph: the yellow line should jump on each flash, and the Signal reading should show
   *Good*.
5. If nothing decodes, use **Switch to Manual** and key in what you see. Then use **Reply via
   torch** to answer.

Keep the speed slider the same on both phones to start with. 200 ms is about 6 WPM; the receiver
adapts if the two settings differ. iOS Safari can't control the torch, so it uses the screen
flash.

## Layout

```
src/lib/morse/        pure logic + unit tests (morse table, decoder, detector)
src/lib/media/        camera/torch, transmitter, frame sampler, wake lock
src/lib/components/   UI pieces (viewfinder, signal graph, morse preview, keys…)
src/routes/           / (Send), /receive, /manual
src/service-worker/   offline app-shell cache (SvelteKit built-in service worker)
e2e/                  Playwright specs + fake camera clip generator
```

## Native apps later

The static `build/` folder can be wrapped with Capacitor (`webDir: 'build'`) for Android or iOS
without any code changes.
