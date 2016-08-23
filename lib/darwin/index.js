const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')

function darwinSnapshot (opts = {}) {
  let defaults = {
    format: 'jpg',
    silence: true
  }
  Object.assign(defaults, opts)
  return new Promise((resolve, reject) => {
    let tmpPath = temp.path({ suffix: '.' + defaults.format })
    let cmd = 'screencapture ' + (defaults.silence ? '-x ' : '') + '-t ' + defaults.format + ' ' + tmpPath
    exec(cmd, {
      cwd: __dirname
    }, function (err, stdout, stderr) {
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

module.exports = darwinSnapshot
