import type { Screenshot } from './lib/types'

let screenshot: Screenshot
if (process.platform === 'linux') {
  screenshot = require('./lib/linux')
} else if (process.platform === 'darwin') {
  screenshot = require('./lib/darwin')
} else if (process.platform === 'win32') {
  screenshot = require('./lib/win32')
} else {
  screenshot = function unSupported () {
    return Promise.reject(new Error('Currently unsupported platform. Pull requests welcome!'))
  } as Screenshot
}

namespace screenshot {
  export type Screenshot = import('./lib/types').Screenshot
  export type Options = import('./lib/types').ScreenshotOptions
  export type ScreenshotOptions = import('./lib/types').ScreenshotOptions
  export type Display = import('./lib/types').Display
  export type DarwinDisplay = import('./lib/types').DarwinDisplay
  export type LinuxDisplay = import('./lib/types').LinuxDisplay
  export type WindowsDisplay = import('./lib/types').WindowsDisplay
}
export = screenshot
