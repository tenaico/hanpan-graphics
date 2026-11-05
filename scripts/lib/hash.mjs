// SHA-256 of build outputs, written the way `sha256sum` prints them.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

export const sha256File = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')

/** "<hex>  <name>\n" */
export function sha256Line(hex, name) {
  if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`not a sha256: ${hex}`)
  return `${hex}  ${name}\n`
}
