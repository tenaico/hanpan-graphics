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

## Releasing

Run the **Build web builds** workflow (Actions tab) with `release` ticked. The build job (read-only
token, no credentials left in the checkout) builds, scans for brand strings and missing licence
texts, and uploads the zips. A separate release job, the only one with a write token, then makes a
**draft** release `photo-v<ver>-h<n>` / `illust-v<ver>-h<n>` at the built commit with the zip and
its SHA-256. A draft is not visible to Hanpan until it is published.

Before publishing, download the zip from the draft, check it against its `.sha256`, unzip it and
run the Electron smoke on Windows with a GPU against that exact site:
`node scripts/smoke.mjs --app <app> --site <unzipped dir> --checks boot,api,api-immediate,capture,fonts,fonts-early-text`
and with `--query "lang=ko&embedded=hanpan" --checks embedded-with-lang,save-clean` (each embedded check needs a
fresh page with no document: run `--checks embedded` on its own, in a separate run).
For PhotoCraft also run `--gpu none --checks api-no-start` (a page without WebGPU or WebGL: the app
cannot start, and its page API must reject with the reason instead of waiting forever).
The Linux CI smoke runs on a software renderer and only warns.

Then publish the draft, either on the release page (**Edit** → **Publish release**) or with
`gh release edit <tag> --draft=false`. If the smoke fails, delete the draft
(`gh release delete <tag> --cleanup-tag`), fix, bump `hanpanRev` in `pins.json` and run again.
