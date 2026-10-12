# screenshot-desktop

> Capture a screenshot of your local machine

* Multi/Cross Platform
  * Linux: required ImageMagick `apt-get install imagemagick`
  * OSX: No dependencies required!
  * Windows: No dependencies required!
* Promise based API
* JPG output (by default)

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

```js
const screenshot = require('screenshot-desktop')

screenshot({format: 'png'}).then((img) => {
  // img: Buffer filled with png goodness
  // ...
}).catch((err) => {
  // ...
})
```

```js
screenshot.listDisplays().then((displays) => {
  // displays: [{ id, name }, { id, name }]
  screenshot({ screen: displays[displays.length - 1].id })
    .then((img) => {
      // img: Buffer of screenshot of the last display
    });
})
```

```js
screenshot.all().then((imgs) => {
  // imgs: an array of Buffers, one for each screen
})
```

```js
screenshot({ filename: 'shot.jpg' }).then((imgPath) => {
  // imgPath: absolute path to screenshot
  // created in current working directory named shot.png
});

// absolute paths work too. so do pngs
screenshot({ filename: '/Users/brian/Desktop/demo.png' })
```

## screenshot() options

- `filename` Optional. Absolute or relative path to save output.
- `format` Optional. Valid values `png|jpg`. 
- `linuxLibrary` Optional. Linux only. Valid values `scrot|imagemagick`. Which library to use. Note that scrot does not support format or screen selection.

On macOS VMs, display discovery can return an empty list even when screen capture works. Omit `screen` to capture the default display in this case; `screenshot.all()` returns that capture as a one-element array. Explicit display selection still requires detected displays.

## TypeScript

The package includes TypeScript 5+ declarations for the existing JavaScript API. Node.js types
must be available in your TypeScript project (`npm install --save-dev @types/node`).

```ts
import screenshot = require('screenshot-desktop')

const image: Promise<Buffer> = screenshot({ format: 'png' })
const filename: Promise<string> = screenshot({ filename: 'shot.png' })
const options: screenshot.Options = { screen: 0 }
```

Display IDs and metadata vary by platform. The root API exposes shared fields
and optional platform-specific fields; existing platform imports such as
`screenshot-desktop/lib/win32` expose the corresponding display type.

## Windows bundles and Electron

The Windows helper and manifest are embedded in the built JavaScript and extracted
into a real temporary directory before capture. Node-targeted CommonJS bundles
(such as esbuild output) and Electron ASAR packages carry these assets automatically;
no `asarUnpack` or `extraResources` configuration is needed for them.

The original helper files remain in the npm package for existing integrations.
Call the library from Electron's main process, where Node.js APIs are available.

## Development

Run `npm ci` and `npm run build` before loading the package from a checkout.
`npm test` builds automatically, and `npm pack` builds JavaScript and declarations
before packaging. Generated files are ignored by Git. Native capture tests need
a desktop session and the platform's screenshot tools/permissions.

## Licence

MIT &copy; [Ben Evans](https://bencevans.io)
