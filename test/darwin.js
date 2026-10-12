const test = require('ava')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

let execImpl
const originalExec = childProcess.exec
const originalExecFile = childProcess.execFile
childProcess.exec = (...args) => execImpl(...args)
const screenshot = require('../lib/darwin')
childProcess.exec = originalExec

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
let captures

test.beforeEach(() => {
  captures = []
  execImpl = (command, callback) => {
    callback(null, '')
  }
  childProcess.execFile = (file, args, callback) => {
    captures.push({ file, args })
    for (const filename of args.slice(3)) fs.writeFileSync(filename, png)
    callback(null, '')
  }
})

test.afterEach.always(() => {
  childProcess.execFile = originalExecFile
})

test.serial('captures a Buffer when display metadata is empty', async t => {
  t.deepEqual(await screenshot.listDisplays(), [])
  t.deepEqual(await screenshot({ format: 'png' }), png)
  t.is(captures.length, 1)
  t.is(captures[0].file, 'screencapture')
  t.deepEqual(captures[0].args.slice(0, 3), ['-x', '-t', 'png'])
  t.is(captures[0].args.length, 4)
  t.false(fs.existsSync(captures[0].args[3]))
})

test.serial('captures to a file when display metadata is empty', async t => {
  // Use a POSIX relative filename even when mocking macOS capture on Windows.
  const dir = fs.mkdtempSync('screenshot-darwin-')
  const filename = `${dir}/desktop.png`
  try {
    t.is(await screenshot({ format: 'png', filename }), path.resolve(filename))
    t.deepEqual(fs.readFileSync(filename), png)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test.serial('rejects explicit display selection when metadata is empty', async t => {
  for (const screen of [0, 1, -1, '0', null]) {
    await t.throwsAsync(screenshot({ screen }), {
      message: 'No displays detected try dropping screen option'
    })
  }
  t.is(captures.length, 0)
})

test.serial('retains display selection when metadata is available', async t => {
  execImpl = (command, callback) => callback(null, screenshot.EXAMPLE_DISPLAYS_OUTPUT)
  t.deepEqual(await screenshot({ screen: 1, format: 'png' }), png)
  t.is(captures[0].args.length, 5)
  for (const filename of captures[0].args.slice(3)) t.false(fs.existsSync(filename))
  await t.throwsAsync(screenshot({ screen: 2 }))
  t.is(captures.length, 1)
})

test.serial('retains format validation without display metadata', async t => {
  await t.throwsAsync(screenshot({ format: 'png; echo injected' }), { message: 'Invalid format' })
  t.is(captures.length, 0)
})

test.serial('propagates native capture failures without display metadata', async t => {
  const error = new Error('could not create image from display')
  childProcess.execFile = (file, args, callback) => callback(error)
  t.is(await t.throwsAsync(screenshot()), error)
})

test.serial('propagates display discovery command failures', async t => {
  const error = new Error('system_profiler failed')
  execImpl = (command, callback) => callback(error)
  t.is(await t.throwsAsync(screenshot()), error)
  t.is(captures.length, 0)
})

test.serial('all captures the default display when metadata is empty', async t => {
  t.deepEqual(await screenshot.all(), [png])
  t.is(captures.length, 1)
})

test.serial('all propagates default capture failures', async t => {
  const error = new Error('could not create image from display')
  childProcess.execFile = (file, args, callback) => callback(error)
  t.is(await t.throwsAsync(screenshot.all()), error)
})
