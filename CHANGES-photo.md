# Hanpan changes to PhotoCraft

Built from PhotoCraft (https://github.com/storytold/photocraft), by the ArtCraft team, at the commit pinned in `pins.json`.

- window.photocraft page control API: upstream PR #9345 (storytold/photocraft), plus requests made before the app runs waiting for it, plus captureDownloads/files/readFile ported from VectorCraft's web API, plus `app.save` writing through the browser download (or the page's capture) on the web.
- Korean text: NanumGothic Regular (OFL-1.1, from craft-fonts) in fonts/manifest.txt at the site root, which the web build fetches as the Hangul fallback.
