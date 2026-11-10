import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  scanBrand,
  scanSource,
  isSourceToScan,
  isShippedText,
  scanAppName,
  ALLOWED,
  newFilesOfPatch,
} from '../scripts/lib/brand.mjs'

const OK = 'Based on PhotoCraft by the ArtCraft team (MIT or Apache-2.0), modified for Hanpan.'

test('scanBrand finds variants', () => {
  const hits = scanBrand('x', Buffer.from('Join https://DISCORD.gg/abc or getArtCraft.com — ARTCRAFT'), [OK])
  assert.deepEqual(
    hits.map((h) => h.match.toLowerCase()),
    ['discord.gg', 'getartcraft', 'artcraft'],
  )
})

test('finds a discord invite link and reports the file and offset', () => {
  const hits = scanBrand('app.wasm', Buffer.from('\0\0https://discord.com/invite/xyz'), [OK])
  assert.equal(hits.length, 1)
  assert.equal(hits[0].file, 'app.wasm')
  assert.equal(hits[0].offset, 10)
})

test('allows ArtCraft inside the credit sentence only', () => {
  assert.deepEqual(scanBrand('x', Buffer.from(`About: ${OK}`), [OK]), [])
  assert.equal(scanBrand('x', Buffer.from(`${OK} Made by ArtCraft.`), [OK]).length, 1)
})

test('finds spaced, dashed and dotted ArtCraft, and the Korean and Japanese names', () => {
  const text = 'Art Craft · art-craft · ART_CRAFT · Art.Craft · 아트크래프트 · 아트 크래프트 · アートクラフト'
  const hits = scanBrand('x', Buffer.from(text, 'utf8'), [OK])
  assert.equal(hits.length, 7, JSON.stringify(hits))
})

test('finds dsc.gg and discord invite links but not the bare word Discord', () => {
  const hits = scanBrand('x', Buffer.from('dsc.gg/artc discord.com/invite/x Discord feedback', 'utf8'), [OK])
  assert.deepEqual(
    hits.map((h) => h.match.toLowerCase()),
    ['dsc.gg', 'discord.com/invite'],
  )
})

test('does not flag words that only end in "art" before craft', () => {
  assert.deepEqual(scanBrand('x', Buffer.from('start-craft smart craft', 'utf8'), [OK]), [])
})

test('reports a non-ASCII hit at its byte offset', () => {
  const hits = scanBrand('x', Buffer.from('é 아트크래프트', 'utf8'), [OK])
  assert.equal(hits.length, 1)
  assert.equal(hits[0].offset, 3) // é is two bytes, then a space
})

test('scanSource reports file:line, skips comment lines and keeps the credit sentence', () => {
  const tsv = '# names (PhotoCraft, ArtCraft) stay\nabout\tAbout\n도움말\t아트크래프트 웹사이트\n'
  assert.deepEqual(
    scanSource('crates/ui-egui/src/i18n/ko.tsv', tsv, [OK]).map((h) => `${h.file}:${h.line} ${h.match}`),
    ['crates/ui-egui/src/i18n/ko.tsv:3 아트크래프트'],
  )
  const rs = `// Help › ArtCraft website\n/// see getartcraft.com\n  ui.label("${OK}");\n  open("https://dsc.gg/x");\n`
  assert.deepEqual(
    scanSource('crates/ui/src/menu.rs', rs, [OK]).map((h) => `${h.file}:${h.line} ${h.match}`),
    ['crates/ui/src/menu.rs:4 dsc.gg'],
  )
})

test('isSourceToScan: translations, non-test Rust in crates, Rust and HTML in apps', () => {
  const yes = [
    'crates/ui-egui/src/i18n/ko.tsv',
    'crates/ui-egui/src/menus/invoke.rs',
    'apps/photocraft-web/src/api.rs',
    'apps/photocraft-web/index.html',
  ]
  const no = [
    'crates/ui-egui/src/menus/tests.rs',
    'crates/ui-egui/src/panels/tests_strokeux.rs',
    'crates/ui-egui/tests/menu.rs',
    'crates/algo/benches/x.rs',
    'crates/ui-egui/docs/x.rs',
    'crates/ui-egui/examples/x.rs',
    'crates/ui-egui/README.md',
    'crates/ui-egui/src/data.tsv',
    'apps/photocraft-web/style.css',
    'docs/brand/x.rs',
    'target/x.rs',
  ]
  for (const p of yes) assert.ok(isSourceToScan(p), p)
  for (const p of no) assert.ok(!isSourceToScan(p), p)
  assert.ok(isSourceToScan('crates\\ui-egui\\src\\i18n\\ko.tsv'), 'Windows separators')
})

test('isShippedText: licence and notice texts, with either separator, only at their real place', () => {
  const yes = [
    'NOTICE',
    'LICENSE-MIT',
    'ATTRIBUTION.md',
    'HANPAN-CHANGES.md',
    'licenses/craft-fonts/nanum-gothic/OFL.txt',
    'licenses\\craft-fonts\\nanum-gothic\\OFL.txt',
    'assets/fonts/OFL-Inter.txt',
    'docs/brand/LICENSE-brand.txt',
    'licenses/pdf-backend/hayro-interpret/assets/LICENSE_FOXIT',
  ]
  const no = ['index.html', 'photocraft-web_bg.wasm', 'snippets/x/licenses/y.js', 'fonts/manifest.txt', 'NOTICE.js']
  for (const p of yes) assert.ok(isShippedText(p), p)
  for (const p of no) assert.ok(!isShippedText(p), p)
})

test('the chrome names neither app', () => {
  assert.equal(scanAppName('photo', 'crates/ui-egui/src/i18n/ko.tsv', 'ui\tPhotoCraft\t포토크래프트', ALLOWED.photo).length, 1)
  assert.equal(scanAppName('illust', 'crates/ui-egui/src/canvas/home.rs', 'tl!("Welcome to VectorCraft")', ALLOWED.illust).length, 1)
})
test('About and notices may name the app', () => {
  assert.equal(scanAppName('photo', 'crates/engine/src/shell_commands.rs', '"About PhotoCraft"', ALLOWED.photo).length, 0)
  assert.equal(scanAppName('illust', 'crates/ui-egui/src/dialogs/about.rs', 'Icons: Lucide (ISC) + VectorCraft.', ALLOWED.illust).length, 0)
})
test('code identifiers are not names', () => {
  assert.equal(scanAppName('photo', 'x.rs', 'let a = photocraft_ui_egui::PhotocraftApp::new();', ALLOWED.photo).length, 0)
})

test('scanAppName: one finding per line with file:line, the Korean names, comments skipped but not in HTML', () => {
  const rs = '//! PhotoCraft in Hanpan\nui.label("포토크래프트");\nlet x = 1;\nui.label("PhotoCraft PhotoCraft");\n'
  assert.deepEqual(
    scanAppName('photo', 'crates/ui-egui/src/x.rs', rs, ALLOWED.photo).map((h) => `${h.file}:${h.line} ${h.match}`),
    ['crates/ui-egui/src/x.rs:2 포토크래프트', 'crates/ui-egui/src/x.rs:4 PhotoCraft, PhotoCraft'],
  )
  const html = '<!-- 벡터크래프트 -->\n<title>Illustration editor</title>\n'
  assert.equal(scanAppName('illust', 'apps/vectorcraft-web/index.html', html, ALLOWED.illust).length, 1)
  // each app is checked for its own name only
  assert.equal(scanAppName('photo', 'x.rs', 'ui.label("VectorCraft")', ALLOWED.photo).length, 0)
})

test('scanAppName: a tsv line is judged by its English column', () => {
  const f = 'crates/ui-egui/src/i18n/ko.tsv'
  assert.equal(scanAppName('photo', f, '\tAbout PhotoCraft\tPhotoCraft 정보', ALLOWED.photo).length, 0)
  assert.equal(scanAppName('photo', f, '\tPhotoCraft on GitHub\tGitHub의 PhotoCraft', ALLOWED.photo).length, 1)
  assert.equal(scanAppName('photo', f, '\tImage editor\t포토크래프트 편집기', ALLOWED.photo).length, 1)
  assert.equal(scanAppName('photo', f, '# PhotoCraft release checks.', ALLOWED.photo).length, 0)
})

test("scanAppName: PhotoCraft's About body is allowed inside about_tab_body only", () => {
  const f = 'crates/ui-egui/src/dialogs.rs'
  const rs = [
    'fn about_tab_body(app: &mut PhotocraftApp, ui: &mut egui::Ui, tab: &str) {',
    '    ui.label(tl!("PhotoCraft — an open-source, native image editor written in Rust."));',
    '}',
    '',
    'fn other(ui: &mut egui::Ui) {',
    '    ui.label("PhotoCraft");',
    '}',
  ].join('\n')
  assert.deepEqual(scanAppName('photo', f, rs, ALLOWED.photo).map((h) => h.line), [6])
  // the region belongs to that file only
  assert.equal(scanAppName('photo', 'crates/ui-egui/src/other.rs', rs, ALLOWED.photo).length, 2)
})

test('scanAppName: notice files may name the app, a near name of an allowed file may not', () => {
  for (const f of ['NOTICE', 'NOTICE.md', 'ATTRIBUTION.md', 'ASSETS.md', 'LICENSE-MIT', 'licenses/x/LICENSE.txt'])
    assert.equal(scanAppName('illust', f, 'VectorCraft', ALLOWED.illust).length, 0, f)
  assert.equal(scanAppName('illust', 'crates/ui-egui/src/dialogs/about_more.rs', 'VectorCraft', ALLOWED.illust).length, 1)
  assert.equal(scanAppName('photo', 'crates/ui-egui/src/dialogs/about.rs', 'ui.label("PhotoCraft")', ALLOWED.photo).length, 1)
})

test('newFilesOfPatch: the files a patch creates, with either line ending', () => {
  const patch = [
    'diff --git a/crates/ui-egui/src/embedded.rs b/crates/ui-egui/src/embedded.rs',
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    '+++ b/crates/ui-egui/src/embedded.rs',
    'diff --git a/crates/ui-egui/src/lib.rs b/crates/ui-egui/src/lib.rs',
    'index 2222222..3333333 100644',
    '--- a/crates/ui-egui/src/lib.rs',
    '+++ b/crates/ui-egui/src/lib.rs',
    '+new file mode 100644',
  ].join('\r\n')
  assert.deepEqual(newFilesOfPatch(patch), ['crates/ui-egui/src/embedded.rs'])
})

test('a page API rejection naming the app is a finding: Hanpan shows it in the AI panel', () => {
  const rs = '        let _ = reject.call1(&JsValue::NULL, &js_sys::Error::new("PhotoCraft has stopped"));'
  assert.equal(scanAppName('photo', 'apps/photocraft-web/src/api.rs', rs, ALLOWED.photo).length, 1)
})
