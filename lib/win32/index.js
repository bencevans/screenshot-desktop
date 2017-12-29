const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')
const path = require('path')

function windowsSnapshot (displayName = null) {
  return new Promise((resolve, reject) => {
    var tmpPath = temp.path({ suffix: '.jpg' })

    const displayChoice = displayName ? `/d "${displayName}"` : ''

    exec('"' + path.join(__dirname, 'screenCapture.bat') + '" ' + tmpPath + displayChoice, {
      cwd: __dirname
    }, (err, stdout) => {
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

const EXAMPLE_DISPLAYS_OUTPUT = '\r\nC:\\Users\\Devetry Build\\screenshot-desktop>//  2>nul  || \r\n\\\\.\\DISPLAY5\r\n\\\\.\\DISPLAY6\r\n'

function parseDisplaysOutput(output) {
  const
    displaysStartPattern = /2>nul  \|\| /,
    { 0: match, index } = displaysStartPattern.exec(output)
  return output.slice(index + match.length)
    .split('\n')
    .map(s => s.replace(/[\n\r]/g, ''))
    .filter(s => s.length)
    .map(s => ({ id: s, name: s }))
}

function availableDisplays() {
  return new Promise((resolve, reject) => {
    exec(
      '"' + path.join(__dirname, 'screenCapture.bat') + '" /list',
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        resolve(parseDisplaysOutput(stdout))
      })
  })
}

windowsSnapshot.availableDisplays = availableDisplays
windowsSnapshot.parseDisplaysOutput = parseDisplaysOutput
windowsSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT

module.exports = windowsSnapshot
