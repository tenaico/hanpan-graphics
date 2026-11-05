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
