const exec = require('child_process').exec
const Promise = require('pinkie-promise')

function desktop () {
  return new Promise((resolve, reject) => {

    if (process.platform !== 'linux') {
      return reject(new Error('Currently unsupported platform. Pull requests welcome!'))
    }

    exec('import -silent -window root jpeg:- ', {
      encoding: 'buffer',
      maxBuffer: 1024 * 1000
    }, function(err, stdout) {
      if (err) return reject(err)
      resolve(stdout)
    })
  })
}

module.exports = desktop
