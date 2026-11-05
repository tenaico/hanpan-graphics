// Page side of the smoke checks; runs inside the hosted web app. Each check resolves to
// { ok, detail }. Tasks 3, 4 and 6 add checks here.
;(() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const ok = (detail) => ({ ok: true, detail })
  const fail = (detail) => ({ ok: false, detail })
  const METHODS = ['request', 'execute', 'commands', 'inspect', 'screenshot', 'openFile', 'captureDownloads', 'files', 'readFile']
  const MIN_COMMANDS = { photo: 400, illust: 1000 }

  async function waitFor(fn, ms) {
    const t0 = performance.now()
    while (performance.now() - t0 < ms) {
      const v = fn()
      if (v) return v
      await sleep(100)
    }
    return null
  }

  const checks = {
    async boot() {
      const canvas = await waitFor(() => document.querySelector('canvas'), 60000)
      if (!canvas) return fail('no canvas after 60s')
      await sleep(3000)
      return ok(`canvas ${canvas.width}x${canvas.height}`)
    },
    async api({ global, app }) {
      const api = await waitFor(() => window[global], 60000)
      if (!api) return fail(`no window.${global} after 60s`)
      const missing = METHODS.filter((m) => typeof api[m] !== 'function')
      if (missing.length) return fail(`missing ${missing.join(', ')}`)
      const cmds = await api.commands()
      if (!Array.isArray(cmds) || cmds.length < MIN_COMMANDS[app]) return fail(`commands: ${cmds && cmds.length}`)
      return ok(`${cmds.length} commands`)
    },
    // Hanpan calls the API the moment it appears: that call waits for the app, it does not throw
    async 'api-immediate'({ global }) {
      const api = await waitFor(() => window[global], 60000)
      if (!api) return fail(`no window.${global} after 60s`)
      try {
        const cmds = await Promise.race([api.commands(), sleep(60000).then(() => 'timeout')])
        if (cmds === 'timeout') return fail('commands() did not settle in 60s')
        return Array.isArray(cmds) ? ok(`${cmds.length} commands on first call`) : fail(`not an array: ${typeof cmds}`)
      } catch (e) {
        return fail(`first call threw: ${e && e.message}`)
      }
    },
    // a save the page captured can be read back: new document, PNG export, readFile
    async capture({ global }) {
      const api = await waitFor(() => window[global], 60000)
      if (!api) return fail(`no window.${global}`)
      const ids = (await api.commands()).map((c) => c.id)
      // a file export, not the clipboard one
      const exportId =
        ids.find((id) => /^file\.export/i.test(id) && /png/i.test(id)) ??
        ids.find((id) => !/clipboard/i.test(id) && /export/i.test(id) && /png/i.test(id))
      if (!exportId) return fail('no PNG export command')
      api.captureDownloads(true)
      const newResult = global === 'photocraft'
        ? await api.execute('file.new', { width: 320, height: 200 })
        : await api.execute('file.newWithoutDialog', {})
      // PhotoCraft's engine exports write to disk (desktop only); File › Save's path is app.save
      const exported =
        global === 'photocraft'
          ? await api.request('app.save', { path: 'smoke.png' })
          : await api.execute(exportId, { path: 'smoke.png' })
      await sleep(1500)
      const files = await api.files()
      const hit = files.find((f) => /smoke\.png$/.test(f.path))
      if (!hit) return fail(`no captured file; files=${JSON.stringify(files)} export=${JSON.stringify(exported)} new=${JSON.stringify(newResult)}`)
      const bytes = await api.readFile(hit.path)
      const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      return png ? ok(`${exportId} → ${hit.path} ${bytes.length} bytes`) : fail('captured file is not a PNG')
    },
  }

  window.__smoke = {
    async run(name, ctx) {
      const check = checks[name]
      if (!check) return fail(`unknown check ${name}`)
      return check(ctx)
    },
    checks,
  }
})()
