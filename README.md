# screenshot-desktop

> Capture a screenshot of your local machine

* Multi/Cross Platform
  * Linux: required ImageMagick `apt-get install imagemagick`
  * OSX: No dependencies required!
  * Windows: No dependencies required!
* Promise based API
* JPG output

## Install

    $ npm install --save screenshot-desktop

## Usage

```js
const screenshot = require('screenshot-desktop')

screenshot().then((img) => {
  // img: Buffer filled with jpg goodness
  // ...
}).catch((err) => {
  // ...
})
```

## Licence

MIT &copy; [Ben Evans](https://bencevans.io)
