// Reproducible zips: sorted entries, one fixed DOS timestamp, fixed file mode.
import { createWriteStream, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import yazl from 'yazl'

const MTIME = new Date(1980, 0, 1, 0, 0, 0)

function walk(dir, root = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), root) : [relative(root, join(dir, e.name)).split(sep).join('/')],
  )
}

/** zip every file under `dir` into `zipPath`; the same files always give the same bytes */
export function zipDir(dir, zipPath) {
  return new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile()
    for (const rel of walk(dir).sort()) {
      zip.addFile(join(dir, rel), rel, { mtime: MTIME, mode: 0o100644, forceDosTimestamp: true })
    }
    zip.outputStream.pipe(createWriteStream(zipPath)).on('close', resolve).on('error', reject)
    zip.end()
  })
}
