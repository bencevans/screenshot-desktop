const test = require('ava')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')

const displayId = '\\\\.\\DISPLAY1'
const displaysOutput = `\r\nC:\\screenCapture>//  2>nul  || \r\n${displayId};0;1920;1080;0;1\r\n`

let execImpl
const originalExec = childProcess.exec
childProcess.exec = (...args) => execImpl(...args)
const windowsSnapshot = require('../lib/win32')
childProcess.exec = originalExec

function listExampleDisplays (command, options, callback) {
  callback(null, displaysOutput, '')
}

test.serial('rejects a screen that is not in the Windows display list', async t => {
  const originalExecFile = childProcess.execFile
  let captureSpawned = false

  execImpl = listExampleDisplays
  childProcess.execFile = () => {
    captureSpawned = true
  }

  try {
    const error = await t.throwsAsync(windowsSnapshot({
      format: 'png',
      screen: '\\\\.\\DISPLAY1&calc'
    }))

    t.is(error.message, 'Invalid screen')
    t.false(captureSpawned)
  } finally {
    childProcess.execFile = originalExecFile
  }
})

test.serial('passes an exact Windows display id to the capture command', async t => {
  const originalExecFile = childProcess.execFile
  const originalCopyFile = fs.copyFile
  const filename = path.join(process.cwd(), 'valid-display.png')
  let captured

  execImpl = listExampleDisplays
  childProcess.execFile = (file, args, options, callback) => {
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
    childProcess.execFile = originalExecFile
    fs.copyFile = originalCopyFile
  }
})
