# Hanpan changes to VectorCraft

Built from VectorCraft (https://github.com/storytold/vectorcraft), by the ArtCraft team, at the commit pinned in `pins.json`.

- Korean text: NanumGothic Regular (OFL-1.1, from craft-fonts) added to the fonts the web build fetches at startup (crates/text/web-fonts.txt), so Hangul has a fallback.
- Brand: the ArtCraft name, the Discord and getartcraft.com links and their menu entries are removed (code and translations); About carries the plain credit "Based on VectorCraft by the ArtCraft team (MIT or Apache-2.0), modified for Hanpan."
- Embedded mode: with `embedded=hanpan` in the page address, Open, Open Recent, Close and Close All are off and hidden, New works only until the first document exists, and a file dropped off the canvas while a document is open is not opened as another document; without it the app is unchanged.
- The PC's fonts (embedded mode): the font menus end with a section "이 PC의 글꼴" listing the fonts installed on the PC, read with the browser's Local Font Access API (`window.queryLocalFonts()`) when a font menu first opens; a family picked there has its files read and added to the app's fonts, then is applied (the canvas, PNG export, and SVG export as outlines or with the font embedded as `@font-face` use it like any other font; plain SVG text names the family, which a viewer without that font replaces). The page API's `vectorcraft.request('fonts.local', {family?})` does the same for the host. The host must allow the `local-fonts` permission for the app's frame.
- Licences: the licence texts the upstream NOTICE and ASSETS.md name (fonts, icons, brand terms) ship in the site at the paths those files give.
