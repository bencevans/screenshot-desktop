const test = require('ava')
const { execFileSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const vm = require('vm')

const root = path.resolve(__dirname, '..')

test('packed package preserves CommonJS paths and supports ESM and TypeScript imports', t => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot-desktop-package-'))
  try {
    const result = JSON.parse(execFileSync(process.execPath, [
      process.env.npm_execpath,
      'pack', '--json', '--pack-destination', fixture,
      '--cache', path.join(fixture, 'cache')
    ], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
    const packed = Array.isArray(result) ? result[0] : Object.values(result)[0]
    const files = packed.files.map(file => file.path)
    for (const required of [
      'index.js', 'index.d.ts', 'lib/types.d.ts',
      'lib/utils.js', 'lib/utils.d.ts',
      'lib/linux/index.js', 'lib/linux/index.d.ts',
      'lib/darwin/index.js', 'lib/darwin/index.d.ts',
      'lib/win32/index.js', 'lib/win32/index.d.ts',
      'lib/win32/app.manifest', 'lib/win32/screenCapture_1.3.3.bat'
    ]) {
      t.true(files.includes(required), `package includes ${required}`)
    }
    const packageDir = path.join(fixture, 'node_modules', 'screenshot-desktop')
    fs.mkdirSync(packageDir, { recursive: true })
    execFileSync('tar', ['-xzf', path.join(fixture, packed.filename), '-C', packageDir, '--strip-components=1'])
    // Supply installed dependencies without downloading anything during this test.
    for (const dependency of ['temp', '@types/node', 'undici-types']) {
      const destination = path.join(fixture, 'node_modules', dependency)
      fs.mkdirSync(path.dirname(destination), { recursive: true })
      fs.symlinkSync(path.dirname(require.resolve(`${dependency}/package.json`)), destination, 'junction')
    }
    for (const asset of ['app.manifest', 'screenCapture_1.3.3.bat']) {
      t.deepEqual(
        fs.readFileSync(path.join(packageDir, 'lib/win32', asset)),
        fs.readFileSync(path.join(root, 'lib/win32', asset))
      )
    }
    fs.writeFileSync(path.join(fixture, 'consumer.cjs'), `
      const assert = require('assert/strict')
      const screenshot = require('screenshot-desktop')
      assert.equal(typeof screenshot, 'function')
      assert.equal(require('screenshot-desktop/lib/' + process.platform), screenshot)
      assert.equal(screenshot.screenshot, undefined)
      assert.equal(typeof screenshot.listDisplays, 'function')
      assert.equal(typeof screenshot.all, 'function')
      assert.equal(require('screenshot-desktop/index'), screenshot)
      assert.equal(require('screenshot-desktop/index.js'), screenshot)
      assert.equal(require('screenshot-desktop/'), screenshot)
      assert.equal(require('screenshot-desktop/package.json').name, 'screenshot-desktop')
      assert.equal(typeof require('screenshot-desktop/lib/utils').defaultAll, 'function')
      assert.equal(typeof require('screenshot-desktop/lib/utils.js').defaultAll, 'function')
      for (const platform of ['linux', 'darwin', 'win32']) {
        const backend = require('screenshot-desktop/lib/' + platform)
        assert.equal(typeof backend, 'function')
        assert.equal(require('screenshot-desktop/lib/' + platform + '/'), backend)
        assert.equal(require('screenshot-desktop/lib/' + platform + '/index'), backend)
        assert.equal(require('screenshot-desktop/lib/' + platform + '/index.js'), backend)
      }
      assert.ok(require.resolve('screenshot-desktop/lib/win32/app.manifest'))
      assert.ok(require.resolve('screenshot-desktop/lib/win32/screenCapture_1.3.3.bat'))
      ;(async () => {
        const esm = await import('screenshot-desktop')
        assert.equal(esm.default, screenshot)
      })().catch(error => { console.error(error); process.exitCode = 1 })
    `)
    execFileSync(process.execPath, ['consumer.cjs'], { cwd: fixture, encoding: 'utf8', stdio: 'pipe' })
    t.pass('CommonJS and ES module entry points share the original callable function')

    const assertions = `
      import type { Buffer } from 'buffer'
      const image: Promise<Buffer> = screenshot()
      const emptyFilename: Promise<Buffer> = screenshot({ filename: '' })
      const png: Promise<Buffer> = screenshot({ format: 'png', screen: 0 })
      const filename: Promise<string> = screenshot({ filename: 'shot.png', screen: 'DISPLAY' })
      const variableFilename: string = Math.random() ? 'shot.png' : ''
      const variableResult: Promise<Buffer | string> = screenshot({ filename: variableFilename })
      // @ts-expect-error a dynamically empty filename can return a Buffer
      const wrongVariableResult: Promise<string> = screenshot({ filename: variableFilename })
      const options: ScreenshotOptions = { format: 'png' }
      const result: Promise<Buffer | string> = screenshot(options)
      const images: Promise<Buffer[]> = screenshot.all()
      const displays: Promise<Display[]> = screenshot.listDisplays()
      // @ts-expect-error screen ids are strings or numbers
      screenshot({ screen: true })
      // @ts-expect-error captures without a filename return a Buffer
      const wrongResult: Promise<string> = screenshot()
      // @ts-expect-error unknown Linux capture library
      screenshot({ linuxLibrary: 'unknown' })
    `
    fs.writeFileSync(path.join(fixture, 'commonjs.cts'), `
      import screenshot = require('screenshot-desktop')
      import type { ScreenshotOptions, Display } from 'screenshot-desktop'
      import linux = require('screenshot-desktop/lib/linux')
      import darwin = require('screenshot-desktop/lib/darwin/index.js')
      import windows = require('screenshot-desktop/lib/win32')
      const legacyOptions: screenshot.Options = { screen: 0 }
      linux.listDisplays().then(displays => { const crop: string = displays[0].crop })
      darwin.listDisplays().then(displays => { const id: number = displays[0].id })
      windows.availableDisplays().then(displays => { const dpi: number = displays[0].dpiScale })
      ${assertions}
    `)
    fs.writeFileSync(path.join(fixture, 'esm.mts'), `
      import screenshot from 'screenshot-desktop'
      import type { ScreenshotOptions, Screenshot, Display } from 'screenshot-desktop'
      ${assertions}
    `)
    fs.writeFileSync(path.join(fixture, 'legacy.ts'), `
      import screenshot from 'screenshot-desktop'
      import type { ScreenshotOptions, Display } from 'screenshot-desktop'
      ${assertions}
    `)
    const compile = args => execFileSync(process.execPath, [
      require.resolve('typescript/bin/tsc'), '--noEmit', '--strict', '--types', 'node', ...args
    ], { cwd: fixture, encoding: 'utf8', stdio: 'pipe' })
    compile(['--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'commonjs.cts', 'esm.mts'])
    compile(['--module', 'CommonJS', '--moduleResolution', 'Node10', '--esModuleInterop', 'legacy.ts'])
    compile(['--module', 'ESNext', '--moduleResolution', 'Bundler', 'esm.mts'])
    t.pass('TypeScript consumers compile with CommonJS, NodeNext and bundler resolution')
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
  }
})


test('unsupported platforms retain the callable rejection without attached methods', async t => {
  const context = { process: { platform: 'unsupported' }, module: { exports: {} } }
  vm.runInNewContext(fs.readFileSync(require.resolve('../'), 'utf8'), context)
  t.is(typeof context.module.exports, 'function')
  t.deepEqual(Object.keys(context.module.exports), [])
  await t.throwsAsync(context.module.exports(), {
    message: 'Currently unsupported platform. Pull requests welcome!'
  })
})
