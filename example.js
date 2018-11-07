const screenshot = require('./')
const fs = require('fs')
const path = require('path');
console.log(__dirname);

screenshot.listDisplays().then((displays) => {

  console.log(displays);
  for (let index = 0; index < displays.length; index++) {
    const display = displays[index];
    const imgpath = path.join(__dirname, Date.now() + '_' + display.id + '.png')
    screenshot({ screen: display.id, filename: imgpath }).then((imgpath) => {
      console.log(imgpath);
    })
  }

})
