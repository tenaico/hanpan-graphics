import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPins, artifactName, releaseTag } from '../scripts/lib/pins.mjs'

test('reads the pinned versions', () => {
  const p = readPins('pins.json')
  assert.equal(p.photo.commit, '7c12f647150f8e7b2e07718f7993b1fcaa57fefe')
  assert.equal(p.illust.commit, '11862f61198c8f62c0b22b6c9a331cc5950ac98d')
  assert.equal(p.craftFonts.commit, 'b076417b5880bd4154bd22f00695b1d28c6bea83')
  assert.equal(p.photo.global, 'photocraft')
  assert.equal(p.illust.global, 'vectorcraft')
})

test('names the outputs', () => {
  const p = readPins('pins.json')
  assert.equal(artifactName('photo', p), 'hanpan-photo-web-0.20.2-h1.zip')
  assert.equal(artifactName('illust', p), 'hanpan-illust-web-0.21.0-h1.zip')
  assert.equal(releaseTag('photo', p), 'photo-v0.20.2-h1')
  assert.equal(releaseTag('illust', p), 'illust-v0.21.0-h1')
})

test('rejects a short commit', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pins-'))
  const pins = JSON.parse(readFileSync('pins.json', 'utf8'))
  pins.photo.commit = 'abc'
  writeFileSync(join(dir, 'pins.json'), JSON.stringify(pins))
  assert.throws(() => readPins(join(dir, 'pins.json')), /commit/)
})

test('rejects a tag without v and a revision below 1', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pins-'))
  const pins = JSON.parse(readFileSync('pins.json', 'utf8'))
  pins.illust.tag = '0.21.0'
  writeFileSync(join(dir, 'a.json'), JSON.stringify(pins))
  assert.throws(() => readPins(join(dir, 'a.json')), /tag/)
  pins.illust.tag = 'v0.21.0'
  pins.illust.hanpanRev = 0
  writeFileSync(join(dir, 'b.json'), JSON.stringify(pins))
  assert.throws(() => readPins(join(dir, 'b.json')), /hanpanRev/)
})
