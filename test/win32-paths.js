const test = require('ava')
const { spawnSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const windowsTest = process.platform === 'win32' ? test.serial : test.skip
const capture = `
  const assert = require('assert')
  const fs = require('fs')
  const path = require('path')
  const screenshot = require(process.argv[1])
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  async function run () {
    const image = await screenshot({ format: 'png' })
    assert.deepStrictEqual(image.subarray(0, 8), png)
    const displays = await screenshot.listDisplays()
    assert.ok(displays.length)
    const name = 'café 路径 🖼️ & !SCREENSHOT_PATH_EXPANSION! %SCREENSHOT_PATH_EXPANSION% ^ (shot) & mkdir SCREENSHOT_INJECTION & rem .png'
    const filename = path.join(process.env.TEMP, 'Output & Paths', name)
    const result = await screenshot({ format: 'png', filename, screen: displays[0].id })
    assert.strictEqual(result, filename)
    assert.deepStrictEqual(fs.readFileSync(result).subarray(0, 8), png)
    await assert.rejects(screenshot({ screen: '\\\\\\\\.\\\\DISPLAY1 & mkdir SCREENSHOT_INJECTION & rem ' }), { message: 'Invalid screen' })
    await assert.rejects(screenshot({ format: 'png & mkdir SCREENSHOT_INJECTION & rem ' }), { message: 'Invalid format' })
    for (const directory of [process.cwd(), process.env.TEMP, path.join(process.env.TEMP, 'screenCapture')]) {
      assert.strictEqual(fs.existsSync(path.join(directory, 'SCREENSHOT_INJECTION')), false)
    }
    console.log('Windows path capture passed')
  }
  run().catch(error => { console.error(error); process.exitCode = 1 })
`

for (const folder of [
  'plain',
  'with spaces',
  '(parentheses)',
  'ampersand&path',
  '!SCREENSHOT_PATH_EXPANSION!',
  '%SCREENSHOT_PATH_EXPANSION%',
  'caret^path',
  'café 路径',
  'temp & mkdir SCREENSHOT_INJECTION & rem tail'
]) {
  windowsTest(`captures and lists displays with a temporary directory named ${folder}`, t => {
    // Compilation and native capture can be slow on emulated Windows machines.
    t.timeout(120000)
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-desktop-'))
    const tmpDir = path.join(root, folder)
    fs.mkdirSync(tmpDir)
    try {
      // A fresh process also refreshes temp's cached directory and exercises
      // compilation of the batch helper, rather than reusing a compiled copy.
      const result = spawnSync(process.execPath, ['-e', capture, require.resolve('../lib/win32')], {
        cwd: root,
        env: {
          ...process.env,
          TEMP: tmpDir,
          TMP: tmpDir,
          SCREENSHOT_PATH_EXPANSION: 'expanded & mkdir SCREENSHOT_INJECTION & rem '
        },
        encoding: 'utf8',
        timeout: 90000
      })
      t.is(result.status, 0, result.error ? result.error.message : result.stderr || result.stdout)
      t.true(result.stdout.includes('Windows path capture passed'))
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
}
