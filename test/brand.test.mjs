import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanBrand, scanSource, isSourceToScan, isShippedText } from '../scripts/lib/brand.mjs'

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
