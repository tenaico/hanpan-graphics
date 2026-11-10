// The ArtCraft brand terms for modified versions (docs/brand/LICENSE-brand.txt upstream): no
// ArtCraft name or community links, except the plain-text credit sentence.
export const CREDIT = {
  photo: 'Based on PhotoCraft by the ArtCraft team (MIT or Apache-2.0), modified for Hanpan.',
  illust: 'Based on VectorCraft by the ArtCraft team (MIT or Apache-2.0), modified for Hanpan.',
}

// The scan runs on bytes read as latin1 (one char per byte keeps offsets exact), so non-ASCII
// names are matched as their UTF-8 bytes.
const latin1 = (s) => Buffer.from(s, 'utf8').toString('latin1')
const re = (s) => latin1(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Community links. The bare word "Discord" is not flagged: it is a third-party product name,
// not an ArtCraft mark or a link, and the shipped builds and patched sources have none outside
// comments; an invite needs one of these hosts to work.
const LINKS = [/getartcraft/gi, /dsc\.gg/gi, /discord\.gg/gi, /discord\.com\/invite/gi]

// The name: ArtCraft as one word anywhere (as before), "Art Craft" / art-craft / ART_CRAFT /
// Art.Craft as two words (not "start-craft"), and the Korean and Japanese transliterations.
const NAMES = [
  /artcraft/gi,
  /(?<![a-z])art[\s\-_.]craft/gi,
  new RegExp(`${re('아트')}\\s?${re('크래프트')}`, 'g'),
  new RegExp(`${re('アート')}(?:\\s|${re('・')})?${re('クラフト')}`, 'g'),
]

const utf8 = (s) => Buffer.from(s, 'latin1').toString('utf8')

/** every brand string in `bytes` outside the `allowed` sentences, with its byte offset */
export function scanBrand(name, bytes, allowed) {
  const text = bytes.toString('latin1')
  const hits = []
  for (const r of LINKS) {
    for (const m of text.matchAll(r)) hits.push({ file: name, match: m[0], offset: m.index })
  }
  const spans = []
  for (const sentence of allowed) {
    const s = latin1(sentence)
    for (let i = text.indexOf(s); i !== -1; i = text.indexOf(s, i + 1)) spans.push([i, i + s.length])
  }
  for (const r of NAMES) {
    for (const m of text.matchAll(r)) {
      const at = m.index
      if (spans.some(([a, b]) => at >= a && at < b)) continue
      if (text.slice(Math.max(0, at - 3), at).toLowerCase() === 'get') continue // reported as getartcraft
      hits.push({ file: name, match: utf8(m[0]), offset: at })
    }
  }
  return hits.sort((a, b) => a.offset - b.offset)
}

const COMMENT = /^\s*(\/\/|\/\*|\*|#|<!--)/

/**
 * The scan of a source file, line by line: hits carry `line` (1-based) and `file`. Whole-line
 * comments (// /// //! /* * in Rust, # in .tsv, <!-- in HTML) are skipped: the patched sources
 * keep upstream's notes about the brand, which never reach the app.
 */
export function scanSource(name, text, allowed) {
  return text.split(/\r?\n/).flatMap((line, i) => {
    if (COMMENT.test(line)) return []
    return scanBrand(name, Buffer.from(line, 'utf8'), allowed).map((h) => ({ ...h, line: i + 1 }))
  })
}

const slash = (p) => p.replace(/\\/g, '/')

/**
 * The patched sources whose strings can reach the app: translations under crates/<crate>/…/i18n,
 * non-test Rust under crates/, Rust and HTML under apps/. Tests, benches, examples, docs and
 * build output are left out.
 */
export function isSourceToScan(path) {
  const p = slash(path)
  if (/(^|\/)(tests|benches|examples|docs|target|node_modules|dist)\//.test(p)) return false
  if (/(^|\/)(tests?|tests?_[\w-]*|[\w-]*_tests?)\.rs$/.test(p)) return false
  if (/^crates\/.*\/i18n\/[^/]+\.tsv$/.test(p)) return true
  if (/^crates\/.*\.rs$/.test(p)) return true
  return /^apps\/.*\.(rs|html)$/.test(p)
}

/**
 * Licence and notice texts in a site: they name their authors, and the brand scan is about what
 * the app shows and links to. Root notices, everything under licenses/, and licence texts
 * (OFL*, LICENSE*, *_LICENSE*) wherever the upstream keeps them.
 */
export function isShippedText(path) {
  const p = slash(path)
  if (/^(LICENSE-[A-Z]+|NOTICE|ATTRIBUTION\.md|ASSETS\.md|HANPAN-CHANGES\.md)$/.test(p)) return true
  if (/^licenses\//.test(p)) return true
  return /(^|\/)(OFL|LICEN[CS]E|[\w-]+_LICEN[CS]E)[\w.-]*$/.test(p) && !/\.(js|wasm|html)$/.test(p)
}

// The app names in the chrome (spec 5.4): inside Hanpan the menus, title, start screen and status
// line name neither app. Case-sensitive on purpose: code identifiers (`photocraft_ui_egui`,
// `PhotocraftApp`, `window.photocraft`) are not names a user reads.
const APP_NAMES = {
  photo: [/PhotoCraft/g, /포토크래프트/g],
  illust: [/VectorCraft/g, /벡터크래프트/g],
}

/**
 * Where an app name may stay: About (Help › About and its body) and the notices.
 * - `sentences`: text whose names are allowed wherever it appears (in a .tsv, the English column)
 * - `files`: whole files that are the About body
 * - `regions`: `{ file, fn }`, the body of one Rust function in one file (PhotoCraft's About body
 *   shares dialogs.rs with every other dialog, so only `about_tab_body` is allowed)
 * Notice and licence texts (NOTICE, NOTICE.md, ATTRIBUTION.md, ASSETS.md, licences) always may.
 */
export const ALLOWED = {
  photo: {
    sentences: [
      CREDIT.photo,
      'About PhotoCraft',
      // the page API's rejection reason once the app has stopped (apps/photocraft-web/src/api.rs,
      // patch 0001): Hanpan's code reads it, the chrome never draws it
      'PhotoCraft has stopped',
    ],
    files: [],
    regions: [{ file: 'crates/ui-egui/src/dialogs.rs', fn: 'about_tab_body' }],
  },
  illust: {
    sentences: [
      CREDIT.illust,
      'About VectorCraft',
      // the iOS home-screen name of the page (apps/vectorcraft-web/index.html): only used when a
      // phone adds the standalone site to its home screen, never drawn inside Hanpan
      '<meta name="apple-mobile-web-app-title" content="VectorCraft">',
    ],
    files: ['crates/ui-egui/src/dialogs/about.rs'],
    regions: [],
  },
}

const isNotice = (p) => /^NOTICE\.md$/.test(p) || isShippedText(p)

// the 1-based line numbers inside `fn <name>(…) { … }`, up to the `}` at the fn's own indent
function fnLines(lines, name) {
  const inside = new Set()
  const head = new RegExp(String.raw`^(\s*)(pub(\([^)]*\))?\s+)?fn\s+${name}\b`)
  for (let i = 0; i < lines.length; i++) {
    const m = head.exec(lines[i])
    if (!m) continue
    let j = i
    for (; j < lines.length; j++) {
      inside.add(j + 1)
      if (j > i && lines[j] === `${m[1]}}`) break
    }
    i = j
  }
  return inside
}

/**
 * The app's own name in one file, one finding per line `{ file, line, match }` (`match` lists the
 * names on that line). Whole-line comments are skipped in Rust and .tsv (they never reach the
 * app), not in HTML (a page is checked whole). A .tsv line (context, English, translation) is
 * judged by its English column: when that names the app only inside allowed sentences, the
 * translation of it may too; otherwise any name on the line is a finding.
 */
export function scanAppName(app, file, text, allowed) {
  const p = slash(file)
  if (isNotice(p) || allowed.files.includes(p)) return []
  const lines = text.split(/\r?\n/)
  const freeLines = new Set(allowed.regions.filter((r) => r.file === p).flatMap((r) => [...fnLines(lines, r.fn)]))
  const html = /\.html?$/.test(p)
  const tsv = /\.tsv$/.test(p)
  const names = (s) => APP_NAMES[app].flatMap((r) => [...s.matchAll(r)].map((m) => ({ at: m.index, name: m[0] })))
  const outside = (s) => {
    const spans = allowed.sentences.flatMap((t) => {
      const out = []
      for (let i = s.indexOf(t); i !== -1; i = s.indexOf(t, i + 1)) out.push([i, i + t.length])
      return out
    })
    return names(s).filter(({ at }) => !spans.some(([a, b]) => at >= a && at < b))
  }
  const hits = []
  lines.forEach((line, i) => {
    if (freeLines.has(i + 1)) return
    if (!html && COMMENT.test(line)) return
    let found
    if (tsv) {
      const english = line.split('\t')[1] ?? ''
      const allowedEnglish = names(english).length > 0 && outside(english).length === 0
      found = allowedEnglish ? [] : names(line)
    } else found = outside(line)
    if (found.length) hits.push({ file: p, line: i + 1, match: found.sort((a, b) => a.at - b.at).map((f) => f.name).join(', ') })
  })
  return hits
}

/** the paths a patch creates (`new file mode`), in patch order */
export function newFilesOfPatch(patch) {
  const out = []
  const lines = patch.split(/\r?\n/)
  for (let i = 0; i < lines.length - 1; i++) {
    const m = /^diff --git a\/(\S+) b\/(\S+)$/.exec(lines[i])
    if (m && /^new file mode \d+$/.test(lines[i + 1])) out.push(m[2])
  }
  return out
}
