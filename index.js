const exec = require('child_process').exec
const Promise = require('pinkie-promise')
const fs = require('fs');
const temp = require('temp')
const execOptions = {
  encoding: 'buffer',
  maxBuffer: 1024 * 1000
}

function desktop () {
  return new Promise((resolve, reject) => {

    if (process.platform == 'linux') {
      exec('import -silent -window root jpeg:- ', execOptions,
      function(err, stdout) {
        if (err) {
          return reject(err)
        } else {
          return resolve(stdout)
        }
      })
    }
    else if (process.platform === 'darwin' {
      exec('screencapture -t jpg tmpfile', execOptions, function (err, stdOut) {
        if (err) {
          return reject(err)
        } else {
          let tmpPath = temp.path({suffix: '.jpg'})
          fs.readFile(tmpPath, function (err, img) {
            if (err) {
              return reject(err)
            }
            fs.unlink(tmpPath, function (err) {
              if (err) {
                return reject(err)
              }
              reutrn accept(img)
            })
          })
          return accept(stdOut)
        }
      }
    }
    else if (process.platform === 'windows') {

    } else {
      return reject(new Error('Currently unsupported platform. Pull requests welcome!'))
    }


  })
}

module.exports = desktop
