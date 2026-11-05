import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scanBrand } from '../scripts/lib/brand.mjs'

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
