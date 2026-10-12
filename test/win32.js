const test = require('ava')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const displayId = '\\\\.\\DISPLAY1'
const displaysOutput = `\r\nC:\\screenCapture>//  2>nul  || \r\n${displayId};0;1920;1080;0;1\r\n`

let execFileImpl
const originalExecFile = childProcess.execFile
const windowsSnapshot = require('../lib/win32')

test.beforeEach(() => {
  childProcess.execFile = (...args) => execFileImpl(...args)
})

test.afterEach.always(() => {
  childProcess.execFile = originalExecFile
})

function listExampleDisplays (file, args, options, callback) {
  callback(null, displaysOutput, '')
}

test.serial('rejects a screen that is not in the Windows display list', async t => {
  let captureSpawned = false

  execFileImpl = (file, args, options, callback) => {
    if (args.includes('/list')) return listExampleDisplays(file, args, options, callback)
    captureSpawned = true
  }

  const error = await t.throwsAsync(windowsSnapshot({
    format: 'png',
    screen: '\\\\.\\DISPLAY1&calc'
  }))

  t.is(error.message, 'Invalid screen')
  t.false(captureSpawned)
})

test.serial('passes an exact Windows display id to the capture command', async t => {
  const originalCopyFile = fs.copyFile
  const filename = path.join(process.cwd(), 'valid-display.png')
  let captured

  execFileImpl = (file, args, options, callback) => {
    if (args.includes('/list')) return listExampleDisplays(file, args, options, callback)
    captured = { file, args }
    callback(null, '', '')
  }
  fs.copyFile = (source, destination, callback) => callback(null)

  try {
    const result = await windowsSnapshot({
      filename,
      format: 'png',
      screen: displayId
    })

    t.is(result, filename)
    t.is(captured.file, 'cmd.exe')
    t.deepEqual(captured.args.slice(-2), ['/d', displayId])
  } finally {
    fs.copyFile = originalCopyFile
  }
})

test.serial('rejects when the Windows display list output is not recognized', async t => {
  // A real exec callback runs after the Promise executor has returned.
  execFileImpl = (file, args, options, callback) => {
    setImmediate(() => callback(null, `\r\n${displayId};0;1920;1080;0;1\r\n`, ''))
  }

  await t.throwsAsync(windowsSnapshot.listDisplays(), { instanceOf: TypeError })
})

test.serial('keeps temporary directory paths out of Windows commands', async t => {
  const originalTmpdir = os.tmpdir
  const originalCopyFile = fs.copyFile
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot paths & !percent%-'))
  const filename = path.join(tmpDir, 'Output & Paths', 'café 路径 & !percent% ^ (shot).png')
  const commands = []
  let copiedFrom

  os.tmpdir = () => tmpDir
  execFileImpl = (file, args, options, callback) => {
    commands.push({ file, args, options })
    callback(null, args.includes('/list') ? displaysOutput : '', '')
  }
  fs.copyFile = (source, destination, callback) => {
    copiedFrom = source
    t.is(destination, filename)
    callback(null)
  }

  try {
    t.is(await windowsSnapshot({ filename, format: 'png', screen: displayId }), filename)
    t.is(commands.length, 2)
    for (const command of commands) {
      t.is(command.file, 'cmd.exe')
      t.is(command.options.cwd, path.join(tmpDir, 'screenCapture'))
      t.true(command.options.windowsHide)
      t.deepEqual(command.args.slice(0, 3), ['/d', '/c', 'screenCapture_1.3.3.bat'])
      t.false(command.args.some(arg => arg.includes(tmpDir)))
    }
    t.is(path.dirname(copiedFrom), path.join(tmpDir, 'screenCapture'))
    t.is(commands[1].args[3], path.basename(copiedFrom))
  } finally {
    os.tmpdir = originalTmpdir
    fs.copyFile = originalCopyFile
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})
