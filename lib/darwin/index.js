const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')
const utils = require('../utils')

const { unlinkP, readAndUnlinkP } = utils

function darwinSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    const displayId = options.screen
    if (! Number.isInteger(displayId) || displayId < 0) {
      return reject(`Invalid choice of displayId: ${displayId}`)
    }

    let suffix = '.jpg'
    if (options.filename) {
      const ix = options.filename.lastIndexOf('.')
      suffix = ix >= 0 ? options.filename.slice(ix) : '.jpg'
    }

    const tmpPaths = Array(displayId + 1)
      .fill(null)
      .map(() => temp.path({ suffix }))

    const pathsToDelete = tmpPaths
    if (options.filename) {
      tmpPaths[displayId] = options.filename
      pathsToDelete.pop()
    }

    exec('screencapture -x -t ' + suffix.slice(1) + ' ' + tmpPaths.join(' '), {
      cwd: __dirname
    }, function (err, stdOut) {
      if (err) {
        return reject(err)
      } else {
        fs.readFile(tmpPaths[displayId], function (err, img) {
          if (err) {
            return reject(err)
          }
          Promise.all(pathsToDelete.map(unlinkP))
            .then(() => resolve(options.filename || img))
            .catch((err) => reject(err))
        })
      }
    })
  })
}

const EXAMPLE_DISPLAYS_OUTPUT = `
Graphics/Displays:

    Intel Iris:

      Chipset Model: Intel Iris
      Type: GPU
      Bus: Built-In
      VRAM (Dynamic, Max): 1536 MB
      Vendor: Intel (0x8086)
      Device ID: 0x0a2e
      Revision ID: 0x0009
      Displays:
        Color LCD:
          Display Type: Retina LCD
          Resolution: 2560 x 1600 Retina
          Retina: Yes
          Pixel Depth: 32-Bit Color (ARGB8888)
          Main Display: Yes
          Mirror: Off
          Online: Yes
          Built-In: Yes
        HP 22cwa:
          Resolution: 1920 x 1080 @ 60Hz (1080p)
          Pixel Depth: 32-Bit Color (ARGB8888)
          Display Serial Number: 6CM7201231
          Mirror: Off
          Online: Yes
          Rotation: Supported
          Television: Yes
`

function parseDisplaysOutput(output) {
  const
    displaysPattern = /\n(\s+)Displays:/,
    match = displaysPattern.exec(output),
    displaysIndentation = match[1],
    displayNamePattern = new RegExp(
      //newline plus two more spaces than 'Displays' had, then a word, then a colon
      '\n' + displaysIndentation + '  ' + '(\\w[\\w\\s]+):', 'g'),
    displays = []
  let displayMatch
  while ((displayMatch = displayNamePattern.exec(output)) !== null) {
    displays.push({
      id: displays.length,
      name: displayMatch[1],
    })
  }
  return displays
}

function listDisplays() {
  return new Promise((resolve, reject) => {
    exec(
      'system_profiler SPDisplaysDataType',
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        resolve(parseDisplaysOutput(stdout))
      })
  })
}

function all () {
  return new Promise((resolve, reject) => {
     listDisplays()
      .then((displays) => {
        const fnames = displays.map(() => temp.path({ suffix: '.jpg' }))
        exec('screencapture -x -t jpg ' + tmpPaths.join(' '), {
          cwd: __dirname
        }, function (err, stdOut) {
          if (err) {
            return reject(err)
          } else {
            Promise.all(tmpPaths.map(readAndUnlinkP))
              .then(resolve)
              .catch(reject)
          }
        })
      })
  })
}

darwinSnapshot.listDisplays = listDisplays
darwinSnapshot.all = all
darwinSnapshot.parseDisplaysOutput = parseDisplaysOutput
darwinSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT

module.exports = darwinSnapshot
