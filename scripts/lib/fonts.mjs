// PhotoCraft's web build fetches extra fonts listed in fonts/manifest.txt at the site root (the
// craft-fonts format); NanumGothic gives it Korean text.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sha256File } from './hash.mjs'

const FAMILY = 'NanumGothic'
const STYLE = 'Regular'

/** the site's fonts/manifest.txt text and the files to copy ({ from, to }, `to` relative to the site) */
export function photoFontManifest(craftFontsDir) {
  const line = readFileSync(join(craftFontsDir, 'fonts', 'manifest.txt'), 'utf8')
    .split(/\r?\n/)
    .find((l) => {
      const [family, style] = l.split(' | ')
      return family === FAMILY && style === STYLE
    })
  if (!line) throw new Error(`craft-fonts has no ${FAMILY} ${STYLE}`)
  const [, , file, , , licence, sha] = line.split(' | ')
  const actual = sha256File(join(craftFontsDir, file))
  if (actual !== sha) throw new Error(`${file}: sha256 ${actual}, manifest ${sha}`)
  return {
    manifest: `${line}\n`,
    files: [
      { from: join(craftFontsDir, file), to: file },
      { from: join(craftFontsDir, licence), to: licence },
    ],
  }
}
