import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { photoFontManifest } from '../scripts/lib/fonts.mjs'

/** a craft-fonts layout with a fake NanumGothic whose manifest sha256 is `sha` (default: the real one of the fake bytes) */
function craftFonts(sha) {
  const dir = mkdtempSync(join(tmpdir(), 'craft-fonts-'))
  mkdirSync(join(dir, 'fonts', 'nanum-gothic'), { recursive: true })
  const ttf = Buffer.from('fake font bytes')
  writeFileSync(join(dir, 'fonts', 'nanum-gothic', 'NanumGothic-Regular.ttf'), ttf)
  writeFileSync(join(dir, 'fonts', 'nanum-gothic', 'OFL.txt'), 'OFL')
  const real = createHash('sha256').update(ttf).digest('hex')
  writeFileSync(
    join(dir, 'fonts', 'manifest.txt'),
    [
      '# header',
      'Inter | Regular | fonts/inter/Inter.ttf | Latn | OFL-1.1 | fonts/inter/OFL.txt | ' + 'a'.repeat(64) + ' | src',
      `NanumGothic | Regular | fonts/nanum-gothic/NanumGothic-Regular.ttf | Hang,Kore | OFL-1.1 | fonts/nanum-gothic/OFL.txt | ${sha ?? real} | https://github.com/google/fonts`,
      '',
    ].join('\n'),
  )
  return { dir, real }
}

test('builds the PhotoCraft site manifest for NanumGothic', () => {
  const { dir, real } = craftFonts()
  const { manifest, files } = photoFontManifest(dir)
  assert.equal(
    manifest,
    `NanumGothic | Regular | fonts/nanum-gothic/NanumGothic-Regular.ttf | Hang,Kore | OFL-1.1 | fonts/nanum-gothic/OFL.txt | ${real} | https://github.com/google/fonts\n`,
  )
  assert.deepEqual(
    files.map((f) => f.to),
    ['fonts/nanum-gothic/NanumGothic-Regular.ttf', 'fonts/nanum-gothic/OFL.txt'],
  )
})

test('throws when the font bytes do not match the manifest sha256', () => {
  const { dir } = craftFonts('b'.repeat(64))
  assert.throws(() => photoFontManifest(dir), /sha256/)
})
