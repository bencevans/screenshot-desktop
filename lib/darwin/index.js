const Promise = require('pinkie-promise')
const exec = require('child_process').exec

function darwinSnapshot () {
  return new Promise((resolve, reject) => {

    let tmpPath = temp.path({suffix: '.jpg'})

    exec('screencapture -t jpg ' + tmpPath, execOptions, function (err, stdOut) {
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
    }
  })
}

module.exports = linuxSnapshot
