const exec = require('child_process').exec
const temp = require('temp')
const path = require('path')
const utils = require('../utils')
const fs = require('fs')
const os = require('os')

const {
  readAndUnlinkP,
  defaultAll
} = utils

function copyToTemp () {
  const tmpBat = path.join(os.tmpdir(), 'screenCapture', 'screenCapture_1.3.2.bat')
  const tmpManifest = path.join(os.tmpdir(), 'screenCapture', 'app.manifest')
  const includeBat = path.join(__dirname, 'screenCapture_1.3.2.bat').replace('app.asar', 'app.asar.unpacked')
  const includeManifest = path.join(__dirname, 'app.manifest').replace('app.asar', 'app.asar.unpacked')
  if (!fs.existsSync(tmpBat)) {
    const tmpDir = path.join(os.tmpdir(), 'screenCapture')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir)
    }
    const sourceData = {
      bat: fs.readFileSync(includeBat),
      manifest: fs.readFileSync(includeManifest)
    }
    fs.writeFileSync(tmpBat, sourceData.bat)
    fs.writeFileSync(tmpManifest, sourceData.manifest)
  }
  return tmpBat
}

function windowsSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    const displayName = options.screen
    const format = options.format || 'jpg'
    const tmpPath = temp.path({
      suffix: `.${format}`
    })
    const imgPath = path.resolve(options.filename || tmpPath)

    const displayChoice = displayName ? ` /d "${displayName}"` : ''

    const tmpBat = copyToTemp()

    exec('"' + tmpBat + '" "' + imgPath + '" ' + displayChoice, {
      cwd: path.join(os.tmpdir(), 'screenCapture'),
      windowsHide: true
    }, (err, stdout) => {
      if (err) {
        return reject(err)
      } else {
        if (options.filename) {
          resolve(imgPath)
        } else {
          readAndUnlinkP(tmpPath)
            .then(resolve)
            .catch(reject)
        }
      }
    })
  })
}

const EXAMPLE_DISPLAYS_OUTPUT = '\r\nC:\\Users\\devetry\\screenshot-desktop\\lib\\win32>//  2>nul  || \r\n\\.\\DISPLAY1;0;1920;1080;0\r\n\\.\\DISPLAY2;0;3840;1080;1920\r\n'

function parseDisplaysOutput (output) {
  const displaysStartPattern = /2>nul {2}\|\| /
  const {
    0: match,
    index
  } = displaysStartPattern.exec(output)
  return output.slice(index + match.length)
    .split('\n')
    .map(s => s.replace(/[\n\r]/g, ''))
    .map(s => s.match(/(.*?);(.?\d+);(.?\d+);(.?\d+);(.?\d+);(.?\d*[\.,]?\d+)/)) // eslint-disable-line
    .filter(s => s)
    .map(m => ({
      id: m[1],
      name: m[1],
      top: +m[2],
      right: +m[3],
      bottom: +m[4],
      left: +m[5],
      dpiScale: +m[6].replace(',', '.')
    }))
    .map(d => Object.assign(d, {
      height: d.bottom - d.top,
      width: d.right - d.left
    }))
}

function listDisplays () {
  return new Promise((resolve, reject) => {
    const tmpBat = copyToTemp()
    exec(
      '"' + tmpBat + '" /list', {
        cwd: path.join(os.tmpdir(), 'screenCapture')
      },
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        resolve(parseDisplaysOutput(stdout))
      })
  })
}

windowsSnapshot.listDisplays = listDisplays
windowsSnapshot.availableDisplays = listDisplays
windowsSnapshot.parseDisplaysOutput = parseDisplaysOutput
windowsSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
windowsSnapshot.all = () => defaultAll(windowsSnapshot)

module.exports = windowsSnapshot
