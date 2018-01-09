const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')
const path = require('path')
const utils = require('../utils')

const { unlinkP, readAndUnlinkP, defaultAll } = utils

function windowsSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    const displayName = options.screen
    const tmpPath = temp.path({ suffix: '.jpg' })
    const imgPath = path.resolve(options.filename || tmpPath)

    const displayChoice = displayName ? ` /d "${displayName}"` : ''

    exec('"' + path.join(__dirname, 'screenCapture.bat') + '" ' + imgPath + displayChoice, {
      cwd: __dirname
    }, (err, stdout) => {
      if (err) {
        return reject(err)
      } else {
        if (options.filename) {
          resolve(options.filename)
        } else {
          readAndUnlinkP(tmpPath)
            .then(resolve)
            .catch(reject)
        }
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

function listDisplays() {
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


windowsSnapshot.listDisplays = listDisplays
windowsSnapshot.parseDisplaysOutput = parseDisplaysOutput
windowsSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
windowsSnapshot.all = () => defaultAll(windowsSnapshot)

module.exports = windowsSnapshot
