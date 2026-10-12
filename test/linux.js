const test = require('ava')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

let execImpl
const originalExec = childProcess.exec
const originalExecFile = childProcess.execFile
childProcess.exec = (...args) => execImpl(...args)
const screenshot = require('../lib/linux')
childProcess.exec = originalExec
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
let captures

test.beforeEach(() => {
  captures = []
  execImpl = (command, callback) => callback(null, screenshot.EXAMPLE_DISPLAYS_OUTPUT)
  childProcess.execFile = (file, args, options, callback) => {
    captures.push({ file, args, options })
    if (options.cwd) {
      const name = file === 'scrot' ? args[1] : args[args.length - 1].split(':')[1]
      fs.writeFileSync(path.join(options.cwd, name), png)
    }
    callback(null, png)
  }
})

test.afterEach.always(() => {
  childProcess.execFile = originalExecFile
})

function checkCleanup (t) {
  for (const { options } of captures) {
    if (options.cwd) t.false(fs.existsSync(options.cwd))
  }
}

test.serial('scrot returns a Buffer without stdout or an exec hook', async t => {
  t.deepEqual(await screenshot({ linuxLibrary: 'scrot', format: 'png' }), png)
  t.is(captures[0].file, 'scrot')
  t.deepEqual(captures[0].args, ['-z', 'capture.png'])
  checkCleanup(t)
})

test.serial('scrot uses the requested format for its temporary image', async t => {
  await screenshot({ linuxLibrary: 'scrot', format: 'jpeg' })
  t.deepEqual(captures[0].args, ['-z', 'capture.jpeg'])
  checkCleanup(t)
})

test.serial('ImageMagick buffer capture retains crop and binary stdout', async t => {
  t.deepEqual(await screenshot({ format: 'png', screen: 'DP-2-1' }), png)
  t.is(captures[0].file, 'import')
  t.true(captures[0].args.includes('1920x1080+3840+0'))
  t.is(captures[0].args[captures[0].args.length - 1], 'png:-')
  t.is(captures[0].options.encoding, 'buffer')
})

for (const linuxLibrary of ['scrot', 'imagemagick']) {
  test.serial(`${linuxLibrary} preserves literal output paths and overwrites the exact file`, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linux path café %Y $f & (test)-'))
    const filename = path.join(dir, '-desktop %Y $f & image.png')
    try {
      fs.writeFileSync(filename, 'old image')
      t.is(await screenshot({ linuxLibrary, filename }), filename)
      t.deepEqual(fs.readFileSync(filename), png)
      t.false(captures[0].args.some(arg => arg.includes(filename)))
      checkCleanup(t)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  test.serial(`${linuxLibrary} cleans up and rejects capture failures`, async t => {
    const error = new Error('capture failed')
    childProcess.execFile = (file, args, options, callback) => {
      captures.push({ options })
      fs.writeFileSync(path.join(options.cwd, 'capture.png'), 'partial')
      fs.writeFileSync(path.join(options.cwd, 'extra-partial'), 'extra')
      callback(error)
    }
    await t.throwsAsync(screenshot({ linuxLibrary, filename: 'unused.png', format: 'png' }), { is: error })
    checkCleanup(t)
  })

  test.serial(`${linuxLibrary} cleans up and rejects file copy failures`, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linux-copy-failure-'))
    try {
      await t.throwsAsync(screenshot({ linuxLibrary, filename: path.join(dir, 'missing', 'image.png') }), { code: 'ENOENT' })
      checkCleanup(t)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}

test.serial('scrot cleans up when the output image cannot be read', async t => {
  childProcess.execFile = (file, args, options, callback) => {
    captures.push({ options })
    callback(null, '')
  }
  await t.throwsAsync(screenshot({ linuxLibrary: 'scrot' }), { code: 'ENOENT' })
  checkCleanup(t)
})

test.serial('rejects display discovery failures instead of hanging', async t => {
  const error = new Error('xrandr failed')
  execImpl = (command, callback) => callback(error)
  await t.throwsAsync(screenshot(), { is: error })
  t.is(captures.length, 0)
})

test.serial('rejects invalid formats before starting capture', async t => {
  await t.throwsAsync(screenshot({ linuxLibrary: 'scrot', format: 'invalid' }), { message: 'Invalid format' })
  t.is(captures.length, 0)
})
