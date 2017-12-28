const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')

function darwinSnapshot () {
  return new Promise((resolve, reject) => {
    var tmpPath = temp.path({ suffix: '.jpg' })

    exec('screencapture -x -t jpg ' + tmpPath, {
      cwd: __dirname
    }, function (err, stdOut) {
      if (err) {
        return reject(err)
      } else {
        fs.readFile(tmpPath, function (err, img) {
          if (err) {
            return reject(err)
          }
          fs.unlink(tmpPath, function (err) {
            if (err) {
              return reject(err)
            }
            return resolve(img)
          })
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

function availableDisplays() {
  return new Promise((resolve, reject) => {
    exec(
      'system_profiler SPDisplaysDataType',
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        resolve(parseDisplaysOutput(stdout))
      })
  });
}

darwinSnapshot.availableDisplays = availableDisplays
darwinSnapshot.parseDisplaysOutput = parseDisplaysOutput
darwinSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT

module.exports = darwinSnapshot
