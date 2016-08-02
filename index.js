'strict mode'

if (process.platform === 'linux') {
  module.exports = require('./lib/linux')
} else if (process.platform === 'darwin') {
  module.exports = require('./lib/darwin')
} else if (process.platform === 'win32') {
  module.exports = require('./lib/win32')
} else {
  module.exports = function unSupported () {
    return new Promise((resolve, reject) => {
      return reject(new Error('Currently unsupported platform. Pull requests welcome!'))
    })
  }
}
