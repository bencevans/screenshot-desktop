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
import screenshot from 'screenshot-desktop'

const img = await screenshot()
// img: Buffer containing a JPG screenshot
// ...
```

```js
const img = await screenshot({ format: 'png' })
// img: Buffer containing a PNG screenshot
```

```js
const displays = await screenshot.listDisplays()
// displays: [{ id, name }, { id, name }]
const lastDisplay = displays[displays.length - 1]
const img = await screenshot(lastDisplay ? { screen: lastDisplay.id } : {})
// img: Buffer of the last display, or the default display if none are detected
```

```js
const imgs = await screenshot.all()
// imgs: an array of Buffers, one for each screen
```

```js
const imgPath = await screenshot({ filename: 'shot.jpg' })
// imgPath: absolute path to shot.jpg, saved in the working directory

// Absolute paths work too; set format to request PNG output.
await screenshot({ filename: '/Users/brian/Desktop/demo.png', format: 'png' })
```

## screenshot() options

- `filename` Optional. Absolute or relative path to save output.
- `format` Optional. See [supported image formats](#supported-image-formats) below. Values are case-insensitive.
- `linuxLibrary` Optional. Linux only. Valid values `scrot|imagemagick`. Which library to use. Note that scrot does not support screen selection.

On macOS VMs, display discovery can return an empty list even when screen capture works. Omit `screen` to capture the default display in this case; `screenshot.all()` returns that capture as a one-element array. Explicit display selection still requires detected displays.

## Supported image formats

Support depends on the platform and, on Linux, the selected capture tool.
This matrix applies to both Buffer output and files saved with `filename`.

| `format` | Windows | macOS | Linux: ImageMagick (default) | Linux: scrot |
| --- | --- | --- | --- | --- |
| `jpg`, `jpeg` | Yes | Yes | Yes | Yes |
| `png` | Yes | Yes | Yes | Yes |
| `bmp` | Yes | Yes | Yes | Yes |
| `tiff` | No | Yes | Yes | Yes |
| `gif` | No | Yes | Yes | Depends (see below) |
| `pdf` | No | Yes | No | No |

“Yes” formats were verified with native capture tools in Windows, macOS and Linux
VMs, checking the actual encoding of both returned Buffers and saved files.
“No” means the library rejects that format. Other values, including `webp`,
`emf`, `exif` and `wmf`, are rejected on all platforms.

Linux output also depends on the encoders available in the installed capture tool.
The library accepts `gif` with scrot, but GIF saving failed in the tested Ubuntu
24.04 installation. Use `linuxLibrary: 'imagemagick'` for GIF output.

The default output is JPEG. Set `format` explicitly for consistent behavior across
platforms: Windows and macOS do not infer the encoding from `filename`. Linux
infers PNG from a `.png` filename and otherwise defaults to JPEG; other formats
still need an explicit `format`.

```js
await screenshot({ filename: 'shot.bmp', format: 'bmp' })
```

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
before packaging. Generated files are ignored by Git. Run `npm run format` to format TypeScript with
Prettier and JavaScript with Standard; `npm run lint` checks formatting and types.
Function documentation uses JSDoc comments alongside TypeScript signatures, so it
is also available in editors and the published declarations. Native capture tests need
a desktop session and the platform's screenshot tools/permissions.

## Licence

MIT &copy; [Ben Evans](https://bencevans.io)
