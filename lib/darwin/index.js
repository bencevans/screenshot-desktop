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

module.exports = darwinSnapshot
