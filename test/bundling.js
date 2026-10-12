const test = require('ava')
const esbuild = require('esbuild')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

async function build (directory, mock) {
  const outfile = path.join(directory, 'bundle.cjs')
  await esbuild.build({
    entryPoints: [path.resolve(__dirname, '../index.js')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'cjs',
    ...(mock ? { define: { 'process.platform': '"win32"' } } : {})
  })
  return outfile
}

test('esbuild includes Windows helper assets without adjacent files or node_modules', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle café & (test)-'))
  try {
    const bundle = await build(directory, true)
    const runner = path.join(directory, 'verify.cjs')
    fs.writeFileSync(runner, `
      const assert = require('assert/strict')
      const fs = require('fs')
      const path = require('path')
      const os = require('os')
      const cp = require('child_process')
      os.tmpdir = () => __dirname
      cp.execFile = (file, args, options, callback) => {
        assert.equal(file, 'cmd.exe')
        assert.ok(fs.existsSync(path.join(options.cwd, 'screenCapture_1.3.3.bat')))
        assert.ok(fs.existsSync(path.join(options.cwd, 'app.manifest')))
        if (args.includes('/list')) return callback(null, '\\r\\nC:\\\\helper>//  2>nul  || \\r\\nDISPLAY1;0;1920;1080;0;1\\r\\n')
        fs.writeFileSync(path.resolve(options.cwd, args[3]), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        callback(null)
      }
      const screenshot = require('./bundle.cjs')
      ;(async () => {
        assert.equal((await screenshot.listDisplays())[0].id, 'DISPLAY1')
        assert.equal((await screenshot({format: 'png'})).toString('hex'), '89504e470d0a1a0a')
        assert.equal(fs.readdirSync(path.join(__dirname, 'screenCapture')).filter(name => name.startsWith('capture-')).length, 0)
      })().catch(error => { console.error(error); process.exitCode = 1 })
    `)
    execFileSync(process.execPath, [runner], { cwd: os.tmpdir(), stdio: 'pipe' })
    for (const filename of ['screenCapture_1.3.3.bat', 'app.manifest']) {
      t.deepEqual(fs.readFileSync(path.join(directory, 'screenCapture', filename)), fs.readFileSync(path.join(__dirname, '../lib/win32', filename)))
    }
    t.false(fs.existsSync(path.join(directory, 'node_modules')))
    t.true(fs.existsSync(bundle))
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

const native = process.platform === 'win32' && process.env.SCREENSHOT_NATIVE_CLEANUP === '1' ? test : test.skip
native('standalone esbuild bundle captures on Windows with a fresh helper cache', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle native café & !percent%-'))
  try {
    await build(directory, false)
    const runner = path.join(directory, 'verify.cjs')
    fs.writeFileSync(runner, `
      const fs = require('fs')
      require('os').tmpdir = () => __dirname
      const screenshot = require('./bundle.cjs')
      ;(async () => {
        if (!(await screenshot.listDisplays()).length) throw Error('No displays')
        const image = await screenshot({ format: 'png' })
        if (image.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw Error('Not PNG')
      })().catch(error => { console.error(error); process.exitCode = 1 })
    `)
    execFileSync(process.execPath, [runner], { cwd: os.tmpdir(), stdio: 'pipe' })
    t.pass()
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
