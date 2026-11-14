# Still / Stories

Vercel deployment is configured. Run `npm.cmd run build` to validate the static output, then follow [DEPLOYMENT.md](DEPLOYMENT.md). Use the directory containing `vercel.json` as the Vercel project root; output is `dist`.

A buildless photography portfolio inspired by the dimensional intro, typographic reveals, film grain, and dark exhibition atmosphere of https://www.hollywoodexhibit2026.com/. Original implementation, typography, copy, and sample imagery; no reference-site code or photography is shipped.

Run `python -m http.server 4173 --directory dist` and open http://localhost:4173.

Edit `dist/app.js` to rename/filter the eight photographs. Replace `dist/assets/photo-1.jpg` through `photo-8.jpg` with your work. Update brand and copy in `dist/index.html`. The contact dialog is a working local demo for previewing a mailto inquiry link, pending your real contact address.

The seven-second intro plays on arrival and can be skipped, dismissed with Escape, or replayed. Reduced-motion visitors go directly to the portfolio. Gallery images open in a keyboard-accessible native dialog with previous/next controls and arrow-key navigation.

Sample photography is downloaded from Unsplash. Original photo IDs, in asset order: 1534528741775-53994a69daeb, 1470071459604-3b5ec3a7fe05, 1515886657613-9f3515b0c78f, 1519608487953-e999c86e7455, 1506794778202-cad84cf45f1d, 1518837695005-2083093ee35b, 1483985988355-763728e1935b, 1470770841072-f978cf4d019e.


Lottie accents: Soft Scroll Down Arrow by Pablo Vargas and Cam Shutter by Vitor Palma, downloaded from LottieFiles. Original .lottie and JSON files, recolored playback data, runtime, and licenses live in dist/assets/lottie/. The scroll cue plays once after the opening; the shutter plays once on entering About and on chapter interactions. No continuous looping. Reduced-motion visitors get static frames; offscreen and background-tab playback pauses. Use ?lottieFrame=15 for deterministic icon frame inspection. Creator credits are available in the footer. Runtime uses the SVG renderer for crisp small icons and file:// compatibility; no remote runtime or asset requests are needed.


Editorial refinement inspired by Gallery Play: a dominant photographic hero, a short editorial transition, an asymmetric image grid, Gallery/Index controls, a detailed photo viewer with contextual inquiry subjects, a native-dialog mobile menu, and a commissions section. The cinematic opening, About chapters, and Lottie accents remain integrated. Styling lives in styles.css, about.css, and refinement.css, in that cascade order. Photography and brand content remain illustrative.

Verification: JavaScript syntax, all stylesheets parsed, DOM interaction checks for intro controls, filters, gallery/index view, photo details/navigation, inquiry context, mobile menu, About tabs, and Lottie playback guards. Browser layout screenshots remain unavailable in this environment. Publication of these changes is pending restoration of access to the existing Sites project; no replacement Site has been created.


Cinematic story layer: Featured Stories presents three photo essays using the existing sample images. The horizontal rail supports native touch/trackpad scrolling, thumbnail selection, previous/next buttons, and arrow/Home/End keys when the rail is focused. Each essay opens its own frame sequence and narrative in the viewer without changing the gallery filter. Gallery/Index changes and thumbnail-to-viewer expansion use the native View Transitions API when available, with immediate updates as the fallback and reduced-motion path. The intro now stages a CSS 3D contact sheet and camera push rather than spiraling cards. No WebGL, server, or additional dependency is required. The new styles are in dist/stories.css.
