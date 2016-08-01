# screenshot-desktop

> Capture a screenshot of your local machine

* Supports Linux (PR's welcomed for OSX/Windows Support)
  * Linux: required ImageMagick `apt-get install imagemagick`

## Install

    $ npm install --save screenshot-desktop

## Usage

```js
const screenshot = require('screenshot')

screenshot().then((img) => {
  // img: Buffer filled with jpg goodness
  // ...
}).catch((err) => {
  // ...
})
```

## Licence

MIT &copy; [Ben Evans](https://bencevans.io)
