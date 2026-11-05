// Files a site gets beyond the web build itself.
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { photoFontManifest } from './fonts.mjs'

/** PhotoCraft: fonts/manifest.txt and NanumGothic, so Korean text has a font */
export function siteExtras(app, workDir) {
  if (app !== 'photo') return []
  const { manifest, files } = photoFontManifest(join(workDir, 'craft-fonts'))
  const tmp = join(mkdtempSync(join(tmpdir(), 'hg-fonts-')), 'manifest.txt')
  writeFileSync(tmp, manifest)
  return [{ from: tmp, to: 'fonts/manifest.txt' }, ...files]
}
