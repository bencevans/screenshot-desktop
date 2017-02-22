const Promise = require('pinkie-promise')
const exec = require('child_process').exec

function linuxSnapshot (opts = {}) {
  let defaults = {
    format: 'jpg',
    silence: true,
    encoding: 'buffer',
    maxBuffer: 1024 * 10000
  }
  Object.assign(defaults, opts)
  return new Promise((resolve, reject) => {
    let cmd = 'import ' + (defaults.silence ? '-silent ' : '') + '-window root ' + '-display :0 ' + defaults.format + ':- '
    exec(cmd, {
      encoding: defaults.encoding,
      maxBuffer: defaults.maxBuffer
    }, (err, stdout, stderr) => {
      if (err) {
        return reject(err)
      } else {
        return resolve(stdout)
      }
    })
  })
}

module.exports = linuxSnapshot
