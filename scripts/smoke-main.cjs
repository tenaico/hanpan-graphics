// Electron main for scripts/smoke.mjs: serves the site from a custom protocol (as Hanpan serves its
// editors), loads it in a hidden window and runs the page checks from smoke-page.js in order.
const { app, BrowserWindow, protocol } = require('electron')
const { readFile, writeFile, mkdir } = require('node:fs/promises')
const { join, extname, normalize, sep } = require('node:path')
const { mkdtempSync } = require('node:fs')
const { tmpdir } = require('node:os')

const opts = JSON.parse(process.env.SMOKE_OPTS)
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
}
const report = (check, ok, detail) => process.stdout.write(`SMOKE ${JSON.stringify({ check, ok, detail })}\n`)

protocol.registerSchemesAsPrivileged([
  { scheme: 'hgsmoke', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])
app.setPath('userData', mkdtempSync(join(tmpdir(), 'hg-smoke-')))

app.whenReady().then(async () => {
  const root = normalize(opts.site + sep)
  protocol.handle('hgsmoke', async (req) => {
    const path = normalize(join(opts.site, decodeURIComponent(new URL(req.url).pathname)))
    if (!path.startsWith(root)) return new Response('forbidden', { status: 403 })
    try {
      const type = TYPES[extname(path)] ?? 'application/octet-stream'
      return new Response(await readFile(path), { headers: { 'content-type': type } })
    } catch {
      return new Response('not found', { status: 404 })
    }
  })
  await mkdir(opts.out, { recursive: true })
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: { backgroundThrottling: false, paintWhenInitiallyHidden: true },
  })
  const consoleLines = []
  win.webContents.on('console-message', (e) => consoleLines.push(e.message))
  // PhotoCraft guards unload; a test window always closes
  win.webContents.on('will-prevent-unload', (e) => e.preventDefault())
  await win.loadURL(`hgsmoke://app/index.html${opts.query ? `?${opts.query}` : ''}`)
  await win.webContents.executeJavaScript(await readFile(join(__dirname, 'smoke-page.js'), 'utf8'))
  for (const check of opts.checks) {
    let result
    try {
      result = await win.webContents.executeJavaScript(
        `window.__smoke.run(${JSON.stringify(check)}, ${JSON.stringify({ global: opts.global, app: opts.app })})`,
      )
    } catch (e) {
      result = { ok: false, detail: String(e) }
    }
    const panics = consoleLines.filter((l) => /panicked/.test(l))
    if (panics.length) result = { ok: false, detail: `panic: ${panics[0].slice(0, 300)}` }
    report(check, result.ok, result.detail)
    try {
      await writeFile(join(opts.out, `smoke-${check}.png`), (await win.webContents.capturePage()).toPNG())
    } catch {}
  }
  await writeFile(join(opts.out, 'smoke-console.log'), consoleLines.join('\n'))
  app.exit(0)
})
