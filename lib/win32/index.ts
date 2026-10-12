import type { ScreenshotOptions, WindowsDisplay } from '../types'
import { Buffer } from 'buffer'
import childProcess = require('child_process')
import path = require('path')
import utils = require('../utils')
import fs = require('fs')
import os = require('os')
import assets = require('./assets')

const { withTemporaryDirectory, defaultAll } = utils

/**
 * Extract embedded helper assets into the shared Windows helper cache.
 * The batch file and manifest must be real files for cmd.exe and the C# compiler.
 * Restore both assets if either is missing; keep the cache for later captures.
 * @returns Absolute path to the executable batch helper.
 */
function copyToTemp() {
  const tmpBat = path.join(os.tmpdir(), 'screenCapture', 'screenCapture_1.3.3.bat')
  const tmpManifest = path.join(os.tmpdir(), 'screenCapture', 'app.manifest')
  if (!fs.existsSync(tmpBat) || !fs.existsSync(tmpManifest)) {
    const tmpDir = path.join(os.tmpdir(), 'screenCapture')
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true })
    }
    const sourceData = {
      // Static imports carry the helper through bundles and ASAR archives.
      // cmd.exe still executes the extracted files in a real directory.
      bat: Buffer.from(assets.bat, 'base64'),
      manifest: Buffer.from(assets.manifest, 'base64')
    }
    fs.writeFileSync(tmpBat, sourceData.bat)
    fs.writeFileSync(tmpManifest, sourceData.manifest)
  }
  return tmpBat
}

/**
 * Capture the Windows desktop or a validated display using the batch helper.
 * Returns image bytes, or an absolute saved path for a nonempty filename.
 * Each capture owns a private directory inside the shared helper cache.
 * Caller filenames are copied via filesystem APIs and never passed to cmd.exe.
 * @param options - Output format, destination and operating-system display ID.
 */
function windowsSnapshot(options: ScreenshotOptions & { filename: '' }): Promise<Buffer>
function windowsSnapshot<const F extends string>(
  options: Omit<ScreenshotOptions, 'filename'> & { filename: F }
): Promise<F extends '' ? Buffer : string extends F ? Buffer | string : string>
function windowsSnapshot(options?: ScreenshotOptions & { filename?: undefined }): Promise<Buffer>
function windowsSnapshot(options: ScreenshotOptions): Promise<Buffer | string>
function windowsSnapshot(options: ScreenshotOptions = {}): Promise<Buffer | string> {
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
        return withTemporaryDirectory(
          'capture-',
          async directory => {
            const imgPath = path.join(directory, `capture.${format}`)
            // Use a generated relative path so temporary directory characters
            // never enter cmd.exe argument expansion.
            const batArgs = [path.relative(tmpDir, imgPath)]
            if (displayName) batArgs.push('/d', displayName)
            await new Promise<void>((resolve, reject) => {
              childProcess.execFile(
                'cmd.exe',
                ['/d', '/c', path.basename(tmpBat), ...batArgs],
                {
                  cwd: tmpDir,
                  windowsHide: true
                },
                err => (err ? reject(err) : resolve())
              )
            })
            if (requestedPath) {
              await new Promise<void>((resolve, reject) => {
                fs.copyFile(imgPath, requestedPath!, err => (err ? reject(err) : resolve()))
              })
              return requestedPath
            }
            return fs.promises.readFile(imgPath)
          },
          tmpDir
        ).then(resolve)
      })
      .catch(reject)
  })
}

const EXAMPLE_DISPLAYS_OUTPUT =
  '\r\nC:\\Users\\devetry\\screenshot-desktop\\lib\\win32>//  2>nul  || \r\n\\.\\DISPLAY1;0;1920;1080;0;1\r\n\\.\\DISPLAY2;0;3840;1080;1920;1\r\n'

/**
 * Read complete display records independently of cmd.exe's echo or diagnostics.
 * Bounds are signed integers; DPI accepts either locale decimal separator.
 * Reject incomplete records and output without displays with a useful error.
 * @param output - Raw stdout from the batch helper with `/list`.
 */
function parseDisplaysOutput(output: string): WindowsDisplay[] {
  const displays: WindowsDisplay[] = []
  const displayIdPattern = /^(?:\\{1,2}\.\\)?DISPLAY\d+$/
  const integerPattern = /^-?\d+$/
  const dpiPattern = /^\d+(?:[.,]\d+)?$/

  for (const line of output.split(/\r\n|\n|\r/)) {
    const fields = line
      .trim()
      .split(';')
      .map(field => field.trim())
    const id = fields[0]
    // Ignore command echoes and diagnostics, which are not display records.
    if (!displayIdPattern.test(id)) continue

    if (
      fields.length !== 6 ||
      !fields.slice(1, 5).every(field => integerPattern.test(field)) ||
      !dpiPattern.test(fields[5])
    ) {
      throw new Error(`Invalid Windows display record for ${id}: expected bounds and DPI scale`)
    }

    const [top, right, bottom, left] = fields.slice(1, 5).map(Number)
    const dpiScale = Number(fields[5].replace(',', '.'))
    const width = right - left
    const height = bottom - top
    if (
      ![top, right, bottom, left, width, height].every(Number.isSafeInteger) ||
      width <= 0 ||
      height <= 0 ||
      !Number.isFinite(dpiScale) ||
      dpiScale <= 0
    ) {
      throw new Error(`Invalid Windows display geometry or DPI scale for ${id}`)
    }
    displays.push({ id, name: id, top, right, bottom, left, dpiScale, width, height })
  }

  if (displays.length === 0) {
    throw new Error('No Windows display records found in screenshot helper output')
  }
  return displays
}

/**
 * Run the extracted helper to discover Windows display IDs and geometry.
 * Execution and malformed-output errors reject the call.
 */
function listDisplays(): Promise<WindowsDisplay[]> {
  return new Promise((resolve, reject) => {
    const tmpBat = copyToTemp()
    childProcess.execFile(
      'cmd.exe',
      ['/d', '/c', path.basename(tmpBat), '/list'],
      {
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
      }
    )
  })
}

windowsSnapshot.listDisplays = listDisplays
windowsSnapshot.availableDisplays = listDisplays
windowsSnapshot.parseDisplaysOutput = parseDisplaysOutput
windowsSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
windowsSnapshot.all = (): Promise<Buffer[]> => defaultAll(windowsSnapshot)

export = windowsSnapshot
