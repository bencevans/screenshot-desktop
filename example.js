const screenshot = require('./')
const fs = require('fs')

let options = {
  format: 'png'
}

screenshot(options).then((img) => {
  fs.writeFile('out.' + options.format, img, function (err) {
    if (err) {
      throw err
    }
    console.log('written to out.' + options.format)
  })
})
.catch((err) => {
  throw err
})
.catch(err => {
  console.log(err);
})

