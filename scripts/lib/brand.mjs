// The ArtCraft brand terms for modified versions (docs/brand/LICENSE-brand.txt upstream): no
// ArtCraft name or community links, except the plain-text credit sentence.
export const CREDIT = {
  photo: 'Based on PhotoCraft by the ArtCraft team (MIT or Apache-2.0), modified for Hanpan.',
  illust: 'Based on VectorCraft by the ArtCraft team (MIT or Apache-2.0), modified for Hanpan.',
}

const LINKS = [/getartcraft/gi, /discord\.gg/gi, /discord\.com\/invite/gi]

/** every brand string in `bytes` outside the `allowed` sentences, with its byte offset */
export function scanBrand(name, bytes, allowed) {
  const text = bytes.toString('latin1') // one char per byte keeps offsets exact
  const hits = []
  for (const re of LINKS) {
    for (const m of text.matchAll(re)) hits.push({ file: name, match: m[0], offset: m.index })
  }
  const spans = []
  for (const sentence of allowed) {
    for (let i = text.indexOf(sentence); i !== -1; i = text.indexOf(sentence, i + 1)) {
      spans.push([i, i + sentence.length])
    }
  }
  for (const m of text.matchAll(/artcraft/gi)) {
    const at = m.index
    if (spans.some(([a, b]) => at >= a && at < b)) continue
    if (text.slice(Math.max(0, at - 3), at).toLowerCase() === 'get') continue // reported as getartcraft
    hits.push({ file: name, match: m[0], offset: at })
  }
  return hits.sort((a, b) => a.offset - b.offset)
}
