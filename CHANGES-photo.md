# Hanpan changes to PhotoCraft

Built from PhotoCraft (https://github.com/storytold/photocraft), by the ArtCraft team, at the commit pinned in `pins.json`.

- window.photocraft page control API: upstream PR #9345 (storytold/photocraft), plus requests made before the app runs waiting for it (and, if the app cannot start, rejecting with the reason instead of waiting forever, with `openFile` returning false), plus captureDownloads/files/readFile ported from VectorCraft's web API, plus `app.save` writing through the browser download (or the page's capture) on the web.
- Korean text: NanumGothic Regular (OFL-1.1, from craft-fonts) in fonts/manifest.txt at the site root, which the web build fetches as the Hangul fallback.
- Brand: the ArtCraft name, the Discord and getartcraft.com links and their Help-menu entries are removed (code and translations); About carries the plain credit "Based on PhotoCraft by the ArtCraft team (MIT or Apache-2.0), modified for Hanpan."
- Embedded mode: with `embedded=hanpan` in the page address, Open, Open Recent, Close and Close All are off and hidden, New works only until the first document exists, and a file dropped off the canvas while a document is open is not opened as another document; without it the app is unchanged.
- Licences: the licence texts the upstream NOTICE and ATTRIBUTION.md name (fonts, icons, word list, face-detection weights, translations, brand terms) ship in the site at the paths those files give.
