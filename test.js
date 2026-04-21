const test = require('ava')
const { path: tempPathSync } = require('temp')
const temp = require('temp')
const { existsSync, unlinkSync } = require('fs')
const screenshot = require('./')
const os = require('os')
const path = require('path')
const fs = require('fs')
const childProcess = require('child_process')

test.before(async () => {
  return screenshot.listDisplays().then(displays => {
    console.log('Displays:', JSON.stringify(displays, null, 2), '\n')
  })
})

test('screenshot', t => {
  t.plan(1)
  return screenshot().then(img => {
    t.truthy(Buffer.isBuffer(img))
  })
})

function checkDisplays (t, displays) {
  t.truthy(Array.isArray(displays))
  displays.forEach(disp => {
    t.truthy(disp.name)
    t.truthy(disp.id !== undefined)
  })
}

test('screenshot each display', t => {
  if (screenshot.availableDisplays) {
    return screenshot.availableDisplays().then(displays => {
      checkDisplays(t, displays)

      displays.forEach(display => {
        screenshot(display.id)
      })
    })
  } else {
    t.pass()
  }
})

test('screenshot to a file', t => {
  t.plan(1)
  const tmpName = tempPathSync({ suffix: '.jpg' })
  return screenshot({ filename: tmpName }).then(() => {
    t.truthy(existsSync(tmpName))
    if (existsSync(tmpName)) unlinkSync(tmpName)
  })
})

test('screenshot specific screen to a file', t => {
  t.plan(1)
  const tmpName = tempPathSync({ suffix: '.jpg' })
  return screenshot({ filename: tmpName, screen: 0 }).then(() => {
    t.truthy(existsSync(tmpName))
    if (existsSync(tmpName)) unlinkSync(tmpName)
  })
})

test('screenshot to a file with a space', t => {
  // https://github.com/bencevans/screenshot-desktop/issues/12
  t.plan(1)
  const tmpName = tempPathSync({ suffix: '.jpg' })
  return screenshot({ filename: tmpName }).then(() => {
    t.truthy(existsSync(tmpName))
    if (existsSync(tmpName)) unlinkSync(tmpName)
  })
})

test('parse display output', t => {
  if (screenshot.EXAMPLE_DISPLAYS_OUTPUT && screenshot.parseDisplaysOutput) {
    const disps = screenshot.parseDisplaysOutput(screenshot.EXAMPLE_DISPLAYS_OUTPUT)
    checkDisplays(t, disps)
  }
})

// Verify that when tmpdir/temp paths contain spaces, the command string
// passed to cmd.exe /c has them caret-escaped (e.g. "Path^ With^ Space").
// Mocks execFile to capture the command without running it, so this works on any OS.
test('win32: paths with spaces are caret-escaped', async t => {
  const TEMP_DIR = path.join('C:', 'TEMP', 'Path With Space')

  const origTmpdir = os.tmpdir
  const origTempPath = temp.path
  const origExistsSync = fs.existsSync
  const origCopyFile = fs.copyFile
  const origExecFile = childProcess.execFile

  os.tmpdir = () => TEMP_DIR
  temp.path = (opts) => path.join(TEMP_DIR, `screenshot${opts.suffix}`)
  fs.existsSync = (p) => String(p).includes('screenCapture') || origExistsSync(p)
  fs.copyFile = (s, d, cb) => cb(null)

  let capturedCmd = null
  childProcess.execFile = (cmd, args, opts, cb) => {
    capturedCmd = args[1]
    cb(null, '', '')
  }

  try {
    delete require.cache[require.resolve('./lib/win32/index.js')]
    const winScreenshot = require('./lib/win32/index.js')
    await winScreenshot({ filename: path.join(TEMP_DIR, 'test.jpg') })

    t.true(capturedCmd.includes('Path^ With^ Space'), 'spaces should be caret-escaped')
    t.false(capturedCmd.includes('Path With Space'), 'no unescaped spaces in paths')
  } finally {
    os.tmpdir = origTmpdir
    temp.path = origTempPath
    fs.existsSync = origExistsSync
    fs.copyFile = origCopyFile
    childProcess.execFile = origExecFile
  }
})
