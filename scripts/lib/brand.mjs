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
