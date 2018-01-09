const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const defaultAll = require('../utils').defaultAll

const EXAMPLE_DISPLAYS_OUTPUT = `1920x1080
1920x1080
1920x1080`

function parseDisplaysOutput(out) {
  return out
    .split('\n')
    .map((line, ix) => ({
      width: +line.split('x')[0],
      height: +line.split('x')[1],
      id: ix,
      name: ix,
    }))
}

function listDevices() {
  return new Promise((resolve, reject) => {
    exec('xrandr | grep "\*" | cut -d" " -f4', (err, stdout) => {
      if (err) {
        return reject(err)
      }
      return resolve(parseDisplaysOutput(stdout))
    })
  })
}

function maxBuffer(screens) {
  return Math.max.apply(null, screens.map(({ width , height }) => height * width))
}

function linuxSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    const screen = options.screen || 0;

    listDevices().then((screens) => {
      exec(`import -silent -window root -display :0.${screen} -screen jpeg:- `, {
        encoding: 'buffer',
        maxBuffer: maxBuffer(screens),
      }, (err, stdout) => {
        if (err) {
          return reject(err)
        } else {
          return resolve(stdout)
        }
      })
  })
}

linuxSnapshot.listDevices = listDevices
linuxSnapshot.parseDisplaysOutput = parseDisplaysOutput
linuxSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
linuxSnapshot.all = () => defaultAll(linuxSnapshot)
module.exports = linuxSnapshot
