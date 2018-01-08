const Promise = require('pinkie-promise')
const fs = require('fs')

function unlinkP(path) {
    return new Promise((resolve, reject) => {
      fs.unlink(path, function(err) {
        if (err) {
          return reject(err)
        }
        return resolve()
      })
    })
  }
  
  function readFileP(path) {
    return new Promise((resolve, reject) => {
      fs.readFile(path, function (err, img) {
        if(err) {
          return reject(err)
        }
        resolve(img)
      })
    })
  }
  
  function readAndUnlinkP(path) {
    return new Promise((resolve, reject) => {
      readFileP(path)
        .then((img) => {
          unlinkP(path)
            .then(() => resolve(img))
            .catch(reject)
        })
        .catch(reject)
    })
  }
  module.exports = {
      unlinkP,
      readFileP,
      readAndUnlinkP,
  }
  