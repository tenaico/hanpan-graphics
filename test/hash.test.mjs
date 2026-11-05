import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { sha256File, sha256Line } from '../scripts/lib/hash.mjs'

test('hashes a file', () => {
  const p = join(mkdtempSync(join(tmpdir(), 'hash-')), 'h.txt')
  writeFileSync(p, 'hello')
  assert.equal(sha256File(p), '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824')
})

test('formats a sha256 line as "<hex>  <name>\n"', () => {
  const hex = 'a'.repeat(64)
  assert.equal(sha256Line(hex, 'x.zip'), `${hex}  x.zip\n`)
  assert.throws(() => sha256Line('xyz', 'x.zip'), /sha256/)
})
