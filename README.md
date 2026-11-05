# hanpan-graphics

Patched web builds of PhotoCraft and VectorCraft for Hanpan's AI 포토 and AI 일러스트 tabs.
Hanpan downloads the release zips and shows each in an editor tab, driven by its AI helper.
See `NOTICE.md` for credits and licences.

## How it builds

1. `pins.json` pins each upstream repository to a tag and commit, and the fonts to a craft-fonts commit.
2. The build fetches the upstream at that commit, applies `patches/<app>/NNNN-*.patch` in order
   (all of them or none), and runs `trunk build --release`.
3. It adds fonts, licences and `HANPAN-CHANGES.md`, and zips the site with its SHA-256.

## 한국어 요약

한판의 AI 포토·AI 일러스트 탭에 쓰는 PhotoCraft·VectorCraft 웹판 수정판을 만드는 저장소입니다.
원본 코드는 담지 않고, 고정한 원본 버전에 우리 패치를 입혀 빌드합니다. 출처와 라이선스는 `NOTICE.md`에 있습니다.

## Releasing

Run the **Build web builds** workflow (Actions tab) with `release` ticked. It builds, scans for
brand strings and publishes `photo-v<ver>-h<n>` / `illust-v<ver>-h<n>` with the zip and its SHA-256.
Before releasing, the Electron smoke must pass on Windows with a GPU:
`node scripts/smoke.mjs --app <app> --site out/<app>/site --checks boot,api,api-immediate,capture,fonts,fonts-early-text`
and with `--query "embedded=hanpan" --checks embedded,save-clean`. The Linux CI smoke runs on a
software renderer and only warns.
