# Lumora — Independent Design & Engineering Studio

A one-page landing site in a single `index.html` file: plain HTML, CSS and JS with no build step. The only library is Lenis (smooth scroll), loaded from unpkg through an importmap.

## Run
Serve this folder and open it in a browser:
```bash
python3 -m http.server 8000 --directory lumora   # http://localhost:8000
```
Opening `index.html` straight from disk works too. If unpkg can't be reached, the page falls back to native scrolling.

## Files
| Path | What it is |
|---|---|
| `index.html` | The page: one `<style>` block, one `<script type="module">` block |
| `hero/after.jpg` | Hero base image, always shown (the LCP image) |
| `hero/before.jpg` | Image the liquid cursor reveal paints along the pointer trail |
| `work/*.jpg` | Images for the portfolio cards, the hero carousel and the About chip |
| `tools/render_images.py` | Script that generates all the images above (`python3 lumora/tools/render_images.py`, needs numpy + Pillow) |

The image naming matches the original: `beforeSrc = hero/after.jpg` and `afterSrc = hero/before.jpg`. To use real photos, drop them in under the same file names.

## Notes
- **Request modal:** the submit is a stub. It validates the fields, waits about 0.9s, then shows a confirmation; nothing is sent anywhere.
- **Placeholder content:** the email address, social links, partner names and project names are all fictional. Replace them before going live.
- **Reduced motion:** with `prefers-reduced-motion`, the liquid canvas is skipped, reveals appear instantly and the carousel does not autoplay.
