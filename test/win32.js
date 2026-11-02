const test = require('ava')
const childProcess = require('child_process')
const fs = require('fs')
const path = require('path')
const os = require('os')

const displayId = '\\\\.\\DISPLAY1'
const displaysOutput = `\r\nC:\\screenCapture>//  2>nul  || \r\n${displayId};0;1920;1080;0;1\r\n`

let execFileImpl
const originalExecFile = childProcess.execFile
const originalHomedir = os.homedir
const windowsSnapshot = require('../lib/win32')

test.beforeEach(() => {
  childProcess.execFile = (...args) => execFileImpl(...args)
  os.homedir = () => os.tmpdir()
})

test.afterEach.always(() => {
  childProcess.execFile = originalExecFile
  os.homedir = originalHomedir
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

test.serial('lists displays when the command echo header is absent', async t => {
  execFileImpl = (file, args, options, callback) => {
    setImmediate(() => callback(null, `${displayId};0;1920;1080;0;1\r\n`, ''))
  }

  const displays = await windowsSnapshot.listDisplays()
  t.is(displays[0].id, displayId)
  t.is(displays[0].width, 1920)
})

test.serial('rejects unrecognized helper output with a useful error', async t => {
  execFileImpl = (file, args, options, callback) => {
    setImmediate(() => callback(null, 'unexpected helper diagnostics', ''))
  }

  await t.throwsAsync(windowsSnapshot.listDisplays(), {
    message: 'No Windows display records found in screenshot helper output'
  })
})

test.serial('keeps profile directory paths out of Windows commands', async t => {
  const originalHomedir = os.homedir
  const originalCopyFile = fs.copyFile
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screenshot paths & !percent%-'))
  const filename = path.join(tmpDir, 'Output & Paths', 'café 路径 & !percent% ^ (shot).png')
  const commands = []
  let copiedFrom

  os.homedir = () => tmpDir
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
      t.is(path.dirname(command.options.cwd), tmpDir)
      t.true(path.basename(command.options.cwd).startsWith('screenCapture-'))
      t.true(command.options.windowsHide)
      t.deepEqual(command.args.slice(0, 3), ['/d', '/c', 'screenCapture_1.3.3.bat'])
      t.false(command.args.some(arg => arg.includes(tmpDir)))
    }
    t.is(path.dirname(path.dirname(copiedFrom)), commands[1].options.cwd)
    t.false(fs.existsSync(path.dirname(copiedFrom)))
    for (const command of commands) t.false(fs.existsSync(command.options.cwd))
    t.not(commands[0].options.cwd, commands[1].options.cwd)
    t.is(commands[1].args[3], path.relative(commands[1].options.cwd, copiedFrom))
  } finally {
    os.homedir = originalHomedir
    fs.copyFile = originalCopyFile
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

for (const mode of ['buffer', 'filename', 'capture failure', 'read failure', 'copy failure']) {
  test.serial(`removes Windows capture directory after ${mode}`, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-cleanup-'))
    const filename = mode === 'copy failure' ? dir : path.join(dir, 'image.png')
    let imagePath
    let helperDir
    const error = new Error('capture failed')
    execFileImpl = (file, args, options, callback) => {
      helperDir = options.cwd
      imagePath = path.resolve(options.cwd, args[3])
      if (mode !== 'read failure') fs.writeFileSync(imagePath, 'image')
      fs.writeFileSync(path.join(path.dirname(imagePath), 'partial'), 'extra')
      callback(mode === 'capture failure' ? error : null)
    }
    try {
      const operation = windowsSnapshot({ format: 'png', ...(['filename', 'copy failure'].includes(mode) ? { filename } : {}) })
      if (mode.endsWith('failure')) {
        const rejected = await t.throwsAsync(operation)
        if (mode === 'capture failure') t.is(rejected, error)
        if (mode === 'read failure') t.is(rejected.code, 'ENOENT')
      } else if (mode === 'filename') {
        t.is(await operation, filename)
        t.is(fs.readFileSync(filename, 'utf8'), 'image')
      } else t.deepEqual(await operation, Buffer.from('image'))
      t.false(fs.existsSync(path.dirname(imagePath)))
      t.false(fs.existsSync(helperDir))
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}

test.serial('concurrent Windows captures have independent directories', async t => {
  const directories = []
  const helpers = []
  execFileImpl = (file, args, options, callback) => {
    const imagePath = path.resolve(options.cwd, args[3])
    directories.push(path.dirname(imagePath))
    helpers.push(options.cwd)
    fs.writeFileSync(imagePath, String(directories.length))
    setImmediate(() => callback(null))
  }
  const images = await Promise.all([windowsSnapshot(), windowsSnapshot()])
  t.not(directories[0], directories[1])
  t.not(helpers[0], helpers[1])
  t.deepEqual(images.map(image => image.toString()).sort(), ['1', '2'])
  for (const dir of directories) t.false(fs.existsSync(dir))
  for (const dir of helpers) t.false(fs.existsSync(dir))
})

test.serial('ignores a pre-planted shared helper and removes the private helper', async t => {
  const originalTmpdir = os.tmpdir
  const originalHomedir = os.homedir
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'windows-planted-cache-'))
  const profile = path.join(dir, 'profile')
  fs.mkdirSync(profile)
  os.tmpdir = () => dir
  os.homedir = () => profile
  const cache = path.join(dir, 'screenCapture')
  fs.mkdirSync(cache)
  const planted = path.join(cache, 'screenCapture_1.3.3.bat')
  fs.writeFileSync(planted, '@echo attacker')
  fs.writeFileSync(path.join(cache, 'app.manifest'), '<attacker/>')
  let helperDir
  execFileImpl = (file, args, options, callback) => {
    helperDir = options.cwd
    t.not(helperDir, cache)
    t.is(path.dirname(helperDir), profile)
    t.deepEqual(fs.readFileSync(path.join(helperDir, 'screenCapture_1.3.3.bat')), fs.readFileSync(path.join(__dirname, '../lib/win32/screenCapture_1.3.3.bat')))
    t.deepEqual(fs.readFileSync(path.join(helperDir, 'app.manifest')), fs.readFileSync(path.join(__dirname, '../lib/win32/app.manifest')))
    callback(null, displaysOutput)
  }
  try {
    t.is((await windowsSnapshot.listDisplays())[0].id, displayId)
    t.false(fs.existsSync(helperDir))
    t.is(fs.readFileSync(planted, 'utf8'), '@echo attacker')
  } finally {
    os.tmpdir = originalTmpdir
    os.homedir = originalHomedir
    fs.rmSync(dir, { recursive: true, force: true })
  }
})
