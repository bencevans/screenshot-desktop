const test = require('ava')
const fs = require('fs')
const os = require('os')
const path = require('path')
const childProcess = require('child_process')
const screenshot = require('../')
const native = process.platform !== 'darwin' || process.env.SCREENSHOT_NATIVE_CLEANUP === '1' ? test.serial : test.skip

native('native capture cleans temporary directories on success and failure', async t => {
  const created = []
  const originalMkdtemp = fs.promises.mkdtemp
  const originalReadFile = fs.promises.readFile
  const originalExecFile = childProcess.execFile
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'native-cleanup-'))
  fs.promises.mkdtemp = async (...args) => {
    const dir = await originalMkdtemp(...args)
    created.push(dir)
    return dir
  }
  const options = { format: 'png', ...(process.platform === 'linux' ? { linuxLibrary: 'scrot' } : {}) }
  const check = () => {
    t.true(created.length > 0)
    for (const dir of created) t.false(fs.existsSync(dir), `removed ${dir}`)
    created.length = 0
  }
  try {
    const image = await screenshot(options)
    t.deepEqual(image.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    check()
    const filename = path.join(output, 'image.png')
    t.is(await screenshot({ ...options, filename }), filename)
    t.true(fs.existsSync(filename))
    check()
    if (process.platform !== 'linux') {
      t.true((await screenshot.all()).every(Buffer.isBuffer))
      check()
    }
    const readError = new Error('injected read failure after native capture')
    fs.promises.readFile = async () => { throw readError }
    t.is(await t.throwsAsync(screenshot(options)), readError)
    fs.promises.readFile = originalReadFile
    check()
    const captureError = new Error('injected failure after native partial output')
    childProcess.execFile = (...args) => {
      if (!['scrot', 'import', 'screencapture', 'cmd.exe'].includes(args[0])) return originalExecFile(...args)
      const callback = args.pop()
      return originalExecFile(...args, (err, ...output) => callback(err || captureError, ...output))
    }
    t.is(await t.throwsAsync(screenshot(options)), captureError)
    childProcess.execFile = originalExecFile
    check()
    if (process.platform !== 'darwin') {
      await t.throwsAsync(screenshot({ ...options, filename: output }))
      check()
    }
  } finally {
    fs.promises.mkdtemp = originalMkdtemp
    fs.promises.readFile = originalReadFile
    childProcess.execFile = originalExecFile
    fs.rmSync(output, { recursive: true, force: true })
  }
})
