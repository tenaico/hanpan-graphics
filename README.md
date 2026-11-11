# hanpan-graphics

Patched web builds of PhotoCraft and VectorCraft for Hanpan's AI 포토 and AI 일러스트 tabs.
Hanpan downloads the release zips and shows each in an editor tab, driven by its AI helper.
See `NOTICE.md` for credits and licences.

## How it builds

1. `pins.json` pins each upstream repository to a tag and commit, and the fonts to a craft-fonts commit.
2. The build fetches the upstream at that commit, applies `patches/<app>/NNNN-*.patch` in order
   (all of them or none), and runs `trunk build --release`.
3. It adds fonts, licences (every licence text the upstream `NOTICE`/`ATTRIBUTION.md`/`ASSETS.md`
   names, at the same path) and `HANPAN-CHANGES.md`, and zips the site with its SHA-256.

## 한국어 요약

한판의 AI 포토·AI 일러스트 탭에 쓰는 PhotoCraft·VectorCraft 웹판 수정판을 만드는 저장소입니다.
원본 코드는 담지 않고, 고정한 원본 버전에 우리 패치를 입혀 빌드합니다. 출처와 라이선스는 `NOTICE.md`에 있습니다.

## Checks on a build

`node scripts/verify.mjs <app>` (CI runs it after each build) reads `out/<app>/site` and the
patched source in `work/<app>` and reports four scans; any finding fails it:

1. brand scan of the site: the ArtCraft name and community links anywhere but the licence and
   notice texts (only the credit sentence may name ArtCraft);
2. the same scan over the patched source (translations, non-test Rust, the web app's Rust and
   HTML), as file:line;
3. every licence text the site's NOTICE / ATTRIBUTION.md / ASSETS.md names is in the site;
4. the app's own name (PhotoCraft / 포토크래프트, VectorCraft / 벡터크래프트, case-sensitive, so
   `photocraft_ui_egui` is not a name) in what the embedded rename cannot reach: the web page
   `apps/<web>/index.html` and the files our patches create (Hanpan's own sources, tests left out,
   read from the patches' `new file mode` entries). About, its body and the notices may name the
   app; the few other exact lines that may are listed and explained in `ALLOWED` in
   `scripts/lib/brand.mjs`.

Scan 4 does not cover upstream's own sources: they name the apps on purpose (the standalone app
keeps its names, and hundreds of catalog, engine and metadata lines say so). Inside Hanpan every
translated or English UI text passes one rename, which the Rust tests of patches photo/0012 and
illust/0010 check over every catalog Hanpan opens; CI does not check those strings again, so run
those tests (`cargo test -p photocraft-ui-egui -- hanpan_brand_tests host_name_tests`, the same
with `vectorcraft-ui-egui`, in a patched checkout) when a patch or the pin changes.

## Releasing

Run the **Build web builds** workflow (Actions tab) with `release` ticked. The build job (read-only
token, no credentials left in the checkout) builds, scans for brand strings, the app's own name and
missing licence texts (`node scripts/verify.mjs <app>`, see above), and uploads the zips. A separate release job, the only one with a write token, then makes a
**draft** release `photo-v<ver>-h<n>` / `illust-v<ver>-h<n>` at the built commit with the zip and
its SHA-256. A draft is not visible to Hanpan until it is published.

Before publishing, download the zip from the draft, check it against its `.sha256`, unzip it and
run the Electron smoke on Windows with a GPU against that exact site:
`node scripts/smoke.mjs --app <app> --site <unzipped dir> --checks boot,api,api-immediate,capture,fonts,fonts-early-text`
and with `--query "lang=ko&embedded=hanpan" --checks embedded-with-lang,save-clean` and `--query "embedded=hanpan" --checks local-fonts` (the PC's fonts: lists them, loads Malgun Gothic and exports Korean text set in it; needs Windows) (each embedded check needs a
fresh page with no document: run `--checks embedded` on its own, in a separate run).
Run `--query "lang=ko&embedded=hanpan" --checks theme,font` and `--query "embedded=hanpan" --checks theme,font`,
each in a fresh page: `theme` switches to Hanpan dark and back to light with `hanpan.theme`, reads
each back with `hanpan.status` and checks, in the app's screenshot, the menu bar (#252525, #ffffff)
and the status bar (#252525, #f3f4f6) against Hanpan's colours. With `lang=ko`, `font` passes when
the interface's Hangul face is applied and reported within 60 s of the app's first reply (Windows:
Malgun Gothic, read at startup without a click; Mac: Apple SD Gothic Neo, or NanumGothic, the
fallback; elsewhere NanumGothic). It prints when the face arrived and the app's own steps
(`uiFontSteps` from `hanpan.status`: asked, PC fonts queried, files read, held, installed, first
frame, in ms since the page started), and warns, without failing, when the face was installed more
than 300 ms after the app's first frame (the first screen then drew NanumGothic). Without `lang=ko`
(any other interface language) `font` passes when no PC face is reported, asked for or installed
5 s after the first reply. Judge the timing on an idle PC: run the
smoke with no build or other heavy work running, since a busy CPU stretches it by seconds.
Also run `--query "embedded=hanpan" --checks host-save` (Save, Save As and Print ask the host and
write nothing themselves) and, for PhotoCraft, `--checks export-psd` (the layered document for
Hanpan's recovery copies).
For PhotoCraft also run `--gpu none --checks api-no-start` (a page without WebGPU or WebGL: the app
cannot start, and its page API must reject with the reason instead of waiting forever).
The Linux CI smoke runs on a software renderer and only warns.

Then publish the draft, either on the release page (**Edit** → **Publish release**) or with
`gh release edit <tag> --draft=false`. If the smoke fails, delete the draft
(`gh release delete <tag> --cleanup-tag`), fix, bump `hanpanRev` in `pins.json` and run again.
Both apps carry the same `hanpanRev` and are released together. h8 = h7 plus the photo dock gap
fix (`patches/photo/0015-hanpan-dock-gutter.patch`; see `CHANGES-photo.md`); h7 was drafted but
never published.
