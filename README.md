# Ayush Vaidande — research portfolio

Personal portfolio for AI research, multimodal systems, and robotics. Built with semantic HTML, CSS, and vanilla JavaScript; served by GitHub Pages from the root of `main`.

**Live:** https://theiotguy.github.io/portfolio/

## Run locally

No package installation or build step is required.

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. Use an HTTP server so clipboard and browser behavior match the deployed site.

## Edit

- `index.html`: biography, experience, research status, project descriptions, links, and search metadata.
- `css/style.css`: responsive layout, typography, light/dark themes, and print styles.
- `js/main.js`: mobile navigation, theme preference, project filtering, email copying, and navigation state.
- `js/splatmap.js`: procedural Gaussian-splat illustration. It is an illustrative sketch, not recorded experimental output.
- `assets/social-card.png`: social sharing preview.

The illustration supports drag, arrow keys, Home to reset, pause/resume, and reduced-motion preferences. It stops rendering offscreen and while the tab is hidden. Core content and links remain available without JavaScript.

Keep paper status and benchmark context explicit when updating research. Project metrics are linked to their corresponding repositories; do not treat different evaluation protocols as directly comparable.

## Check before publishing

```sh
node --check js/main.js
node --check js/splatmap.js
```

Check the site at phone, tablet, and desktop widths in both themes. Verify project filters, mobile menu keyboard behavior, canvas controls, résumé links, and contact actions. GitHub Pages publishes changes pushed to `main`.


### Dataset replay controls

The homepage uses the King’s Hall scan with 69 pre-rendered panoramic captures.
The route slider pauses at a selected metric position; Resume continues from there.
Playback supports 0.5×, 1× and 2× speed, a full-scan display, and orbit/top/follow views.
Adjacent camera captures are blended and buffered so loading does not blank the view.
Reduced-motion preferences start playback paused. Desktop and 390 px layouts were checked.

Run route geometry and endpoint checks with `node --test tests/route-playback.test.mjs`.
Source credits and simulation limitations are in `assets/dataset/ATTRIBUTION.md`.
