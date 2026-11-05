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
