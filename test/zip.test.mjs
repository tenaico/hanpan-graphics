import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { zipDir } from '../scripts/lib/zip.mjs'
import { sha256File } from '../scripts/lib/hash.mjs'

test('zipDir is byte-for-byte reproducible', async () => {
  const root = mkdtempSync(join(tmpdir(), 'zip-'))
  const site = join(root, 'site')
  mkdirSync(join(site, 'fonts'), { recursive: true })
  writeFileSync(join(site, 'index.html'), '<html></html>')
  writeFileSync(join(site, 'fonts', 'a.ttf'), Buffer.alloc(1000, 7))
  await zipDir(site, join(root, 'one.zip'))
  utimesSync(join(site, 'index.html'), new Date(2001, 1, 1), new Date(2001, 1, 1))
  await zipDir(site, join(root, 'two.zip'))
  assert.equal(sha256File(join(root, 'one.zip')), sha256File(join(root, 'two.zip')))
})
