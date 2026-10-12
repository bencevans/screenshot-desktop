import type { ScreenshotOptions, WindowsDisplay } from '../types'
import type { Buffer } from 'buffer'
import childProcess = require('child_process')
import path = require('path')
import utils = require('../utils')
import fs = require('fs')
import os = require('os')

const temp: { path(options: { suffix: string; dir?: string }): string } = require('temp')
const {
  readAndUnlinkP,
  defaultAll
} = utils

function copyToTemp () {
  const tmpBat = path.join(os.tmpdir(), 'screenCapture', 'screenCapture_1.3.3.bat')
  const tmpManifest = path.join(os.tmpdir(), 'screenCapture', 'app.manifest')
  const includeBat = path.join(__dirname, 'screenCapture_1.3.3.bat').replace('app.asar', 'app.asar.unpacked')
  const includeManifest = path.join(__dirname, 'app.manifest').replace('app.asar', 'app.asar.unpacked')
  if (!fs.existsSync(tmpBat)) {
    const tmpDir = path.join(os.tmpdir(), 'screenCapture')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    const sourceData = {
      bat: fs.readFileSync(includeBat),
      manifest: fs.readFileSync(includeManifest)
    }
    fs.writeFileSync(tmpBat, sourceData.bat)
    fs.writeFileSync(tmpManifest, sourceData.manifest)
  }
  return tmpBat
}

function windowsSnapshot (options: ScreenshotOptions & { filename: '' }): Promise<Buffer>
function windowsSnapshot <const F extends string>(options: Omit<ScreenshotOptions, 'filename'> & { filename: F }): Promise<F extends '' ? Buffer : string extends F ? Buffer | string : string>
function windowsSnapshot (options?: ScreenshotOptions & { filename?: undefined }): Promise<Buffer>
function windowsSnapshot (options: ScreenshotOptions): Promise<Buffer | string>
function windowsSnapshot (options: ScreenshotOptions = {}): Promise<Buffer | string> {
  return new Promise<Buffer | string>((resolve, reject) => {
    // Validate format
    const allowedFormats = ['jpg', 'jpeg', 'png', 'bmp']
    const format = (options.format || 'jpg').toLowerCase()
    if (!allowedFormats.includes(format)) {
      return reject(new Error('Invalid format'))
    }

    let requestedPath: string | null = null
    if (options.filename) {
      // The requested filename is only used by filesystem APIs, never cmd.exe.
      // Preserve its characters and let the filesystem reject invalid paths.
      requestedPath = path.resolve(options.filename)
      // Ensure output directory exists
      const outDir = path.dirname(requestedPath)
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
    }

    const displayName = options.screen ? String(options.screen) : ''

    // cmd.exe interprets metacharacters in arguments, so only accept display
    // identifiers returned by the operating system.
    const displayValidation = displayName
      ? listDisplays().then(displays => {
        if (!displays.some(display => display.id === displayName)) {
          throw new Error('Invalid screen')
        }
      })
      : Promise.resolve()

    displayValidation
      .then(() => {
        const tmpBat = copyToTemp()
        const tmpDir = path.dirname(tmpBat)
        const imgPath = temp.path({ dir: tmpDir, suffix: `.${format}` })
        // Keep directory paths out of cmd.exe and the batch file's argument
        // expansion. Both the helper and its output are relative to cwd.
        const batArgs = [path.basename(imgPath)]
        if (displayName) {
          batArgs.push('/d', displayName)
        }
        const args = ['/d', '/c', path.basename(tmpBat), ...batArgs]
        childProcess.execFile('cmd.exe', args, {
          cwd: tmpDir,
          windowsHide: true
        }, (err, stdout, stderr) => {
          if (err) {
            return reject(err)
          }
          if (options.filename) {
            // Copy temp file to requested path
            fs.copyFile(imgPath, requestedPath!, (err) => {
              if (err) return reject(err)
              resolve(requestedPath!)
            })
          } else {
            readAndUnlinkP(imgPath)
              .then(resolve)
              .catch(reject)
          }
        })
      })
      .catch(reject)
  })
}

const EXAMPLE_DISPLAYS_OUTPUT = '\r\nC:\\Users\\devetry\\screenshot-desktop\\lib\\win32>//  2>nul  || \r\n\\.\\DISPLAY1;0;1920;1080;0\r\n\\.\\DISPLAY2;0;3840;1080;1920\r\n'

function parseDisplaysOutput (output: string): WindowsDisplay[] {
  const displaysStartPattern = /2>nul {2}\|\| /
  const {
    0: match,
    index
  } = displaysStartPattern.exec(output)!
  return output.slice(index + match.length)
    .split('\n')
    .map(s => s.replace(/[\n\r]/g, ''))
    .map(s => s.match(/(.*?);(.?\d+);(.?\d+);(.?\d+);(.?\d+);(.?\d*[\.,]?\d+)/)) // eslint-disable-line
    .filter((s): s is RegExpMatchArray => s !== null)
    .map(m => ({
      id: m[1],
      name: m[1],
      top: +m[2],
      right: +m[3],
      bottom: +m[4],
      left: +m[5],
      dpiScale: +m[6].replace(',', '.')
    }))
    .map(d => Object.assign(d, {
      height: d.bottom - d.top,
      width: d.right - d.left
    }))
}

function listDisplays (): Promise<WindowsDisplay[]> {
  return new Promise((resolve, reject) => {
    const tmpBat = copyToTemp()
    childProcess.execFile(
      'cmd.exe', ['/d', '/c', path.basename(tmpBat), '/list'], {
        cwd: path.dirname(tmpBat),
        windowsHide: true
      },
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        try {
          resolve(parseDisplaysOutput(stdout))
        } catch (parseErr) {
          reject(parseErr)
        }
      })
  })
}

windowsSnapshot.listDisplays = listDisplays
windowsSnapshot.availableDisplays = listDisplays
windowsSnapshot.parseDisplaysOutput = parseDisplaysOutput
windowsSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
windowsSnapshot.all = (): Promise<Buffer[]> => defaultAll(windowsSnapshot)

export = windowsSnapshot
