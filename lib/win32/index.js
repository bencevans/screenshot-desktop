const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')
const path = require('path')

function windowsSnapshot () {
  return new Promise((resolve, reject) => {
    var tmpPath = temp.path({ suffix: '.jpg' })

    exec('"' + path.join(__dirname, 'screenCapture.bat') + '" ' + tmpPath, {
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

module.exports = windowsSnapshot
