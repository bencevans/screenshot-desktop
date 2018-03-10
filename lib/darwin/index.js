const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')
const utils = require('../utils')
const path = require('path')

const { unlinkP, readAndUnlinkP } = utils

function darwinSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    const displayId = options.screen || 0
    if (!Number.isInteger(displayId) || displayId < 0) {
      return reject(new Error(`Invalid choice of displayId: ${displayId}`))
    }

    let suffix = '.jpg'
    let filename
    if (options.filename) {
      const ix = options.filename.lastIndexOf('.')
      suffix = ix >= 0 ? options.filename.slice(ix) : '.jpg'
      filename = '"' + options.filename.replace(/"/g, '\\"') + '"'
    }

    const tmpPaths = Array(displayId + 1)
      .fill(null)
      .map(() => temp.path({ suffix }))

    let pathsToDelete = tmpPaths
    if (options.filename) {
      tmpPaths[displayId] = filename
      pathsToDelete = tmpPaths.slice(0, -1)
    }

    exec('screencapture -x -t ' + suffix.slice(1) + ' ' + tmpPaths.join(' '),
      function (err, stdOut) {
        if (err) {
          return reject(err)
        } else if (options.filename) {
          Promise.all(pathsToDelete.map(unlinkP))
            .then(() => resolve(path.resolve(options.filename)))
            .catch((err) => reject(err))
        } else {
          fs.readFile(tmpPaths[displayId], function (err, img) {
            if (err) {
              return reject(err)
            }
            Promise.all(pathsToDelete.map(unlinkP))
              .then(() => resolve(img))
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

function parseDisplaysOutput (output) {
  const displaysPattern = /\n(\s+)Displays:/
  const match = displaysPattern.exec(output)
  const displaysIndentation = match[1]
  const displayNamePattern = new RegExp(
    // newline plus two more spaces than 'Displays' had, then a word, then a colon
    '\n' + displaysIndentation + '  ' + '(\\w[\\w\\s]+):', 'g')
  const displays = []
  let displayMatch
  while ((displayMatch = displayNamePattern.exec(output)) !== null) {
    displays.push({
      id: displays.length,
      name: displayMatch[1]
    })
  }
  return displays
}

function listDisplays () {
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
        const tmpPaths = displays.map(() => temp.path({ suffix: '.jpg' }))
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
