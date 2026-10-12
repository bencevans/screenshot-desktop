import type { ScreenshotOptions, LinuxDisplay } from '../types'
import type { Buffer } from 'buffer'
import childProcess = require('child_process')
import path = require('path')
import { promises as fs } from 'fs'
import os = require('os')
import * as utils from '../utils'

const { exec } = childProcess
const { defaultAll } = utils

const EXAMPLE_DISPLAYS_OUTPUT = `Screen 0: minimum 320 x 200, current 5760 x 1080, maximum 8192 x 8192
eDP-1 connected (normal left inverted right x axis y axis)
  2560x1440     60.00 +
  1920x1440     60.00
  1856x1392     60.01
  1792x1344     60.01
  1920x1200     59.95
  1920x1080     59.93
  1600x1200     60.00
  1680x1050     59.95    59.88
  1600x1024     60.17
  1400x1050     59.98
  1280x1024     60.02
  1440x900      59.89
  1280x960      60.00
  1360x768      59.80    59.96
  1152x864      60.00
  1024x768      60.04    60.00
  960x720       60.00
  928x696       60.05
  896x672       60.01
  960x600       60.00
  960x540       59.99
  800x600       60.00    60.32    56.25
  840x525       60.01    59.88
  800x512       60.17
  700x525       59.98
  640x512       60.02
  720x450       59.89
  640x480       60.00    59.94
  680x384       59.80    59.96
  576x432       60.06
  512x384       60.00
  400x300       60.32    56.34
  320x240       60.05
DP-1 disconnected (normal left inverted right x axis y axis)
HDMI-1 connected primary 1920x1080+0+0 (normal left inverted right x axis y axis) 476mm x 268mm
  1920x1080     60.00*+  50.00    50.00    59.94
  1680x1050     59.88
  1600x900      60.00
  1280x1024     60.02
  1440x900      59.90
  1280x800      59.91
  1280x720      60.00    50.00    59.94
  1024x768      60.00
  800x600       60.32
  720x576       50.00
  720x480       60.00    59.94
  640x480       60.00    59.94
  720x400       70.08
DP-2 disconnected (normal left inverted right x axis y axis)
HDMI-2 disconnected (normal left inverted right x axis y axis)
DP-2-1 connected 1920x1080+3840+0 (normal left inverted right x axis y axis) 476mm x 268mm
  1920x1080     60.00*+  50.00    50.00    59.94
  1680x1050     59.88
  1600x900      60.00
  1280x1024     60.02
  1440x900      59.90
  1280x800      59.91
  1280x720      60.00    50.00    59.94
  1024x768      60.00
  800x600       60.32
  720x576       50.00
  720x480       60.00    59.94
  640x480       60.00    59.94
  720x400       70.08
DP-2-2 connected 1920x1080+1920+0 (normal left inverted right x axis y axis) 476mm x 268mm
  1920x1080     60.00*+  50.00    50.00    59.94
  1680x1050     59.88
  1600x900      60.00
  1280x1024     60.02
  1440x900      59.90
  1280x800      59.91
  1280x720      60.00    50.00    59.94
  1024x768      60.00
  800x600       60.32
  720x576       50.00
  720x480       60.00    59.94
  640x480       60.00    59.94
  720x400       70.08
DP-2-3 disconnected (normal left inverted right x axis y axis)`

function parseDisplaysOutput (out: string): LinuxDisplay[] {
  return out
    .split('\n')
    .filter(line => line.indexOf(' connected ') > 0)
    .filter(line => line.search(/\dx\d/) > 0)
    .map((line, ix) => {
      const parts = line.split(' ')
      const name = parts[0]
      const primary = parts[2] === 'primary'
      const crop = primary ? parts[3] : parts[2]
      const resParts = crop.split(/[x+]/)
      const width = +resParts[0]
      const height = +resParts[1]
      const offsetX = +resParts[2]
      const offsetY = +resParts[3]

      return {
        width,
        height,
        name,
        id: name,
        offsetX,
        offsetY,
        primary,
        crop
      }
    })
}

function listDisplays (): Promise<LinuxDisplay[]> {
  return new Promise((resolve, reject) => {
    exec('xrandr --current', (err, stdout) => {
      if (err) {
        return reject(err)
      }
      return resolve(parseDisplaysOutput(stdout))
    })
  })
}

function maxBuffer (screens: LinuxDisplay[]): number {
  let total = 0
  screens.forEach((screen) => {
    total += screen.height * screen.width
  })
  // PNG can exceed width*height bytes; use larger buffer for high-res screens
  return Math.max(total * 8, 10 * 1024 * 1024)
}

function guessFiletype (filename: string): string {
  switch (path.extname(filename)) {
    case '.jpg':
    case '.jpeg':
      return 'jpeg'
    case '.png':
      return 'png'
  }

  return 'jpeg'
}

function capture (cmd: string, args: string[], options: childProcess.ExecFileOptions): Promise<Buffer | string> {
  return new Promise<Buffer | string>((resolve, reject) => {
    childProcess.execFile(cmd, args, options, (err, stdout) => {
      if (err) return reject(err)
      resolve(stdout)
    })
  })
}

function linuxSnapshot (options: ScreenshotOptions & { filename: '' }): Promise<Buffer>
function linuxSnapshot (options: ScreenshotOptions & { filename: string }): Promise<string>
function linuxSnapshot (options?: ScreenshotOptions & { filename?: undefined }): Promise<Buffer>
function linuxSnapshot (options: ScreenshotOptions): Promise<Buffer | string>
async function linuxSnapshot (options: ScreenshotOptions = {}): Promise<Buffer | string> {
  const screens = await listDisplays()
  const screen = screens.find(options.screen ? screen => screen.id === options.screen : screen => screen.primary || screen.id === 'default') || screens[0]

  const allowedFormats = ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'gif']
  const filetype = (options.format || guessFiletype(options.filename || '')).toLowerCase()
  if (!allowedFormats.includes(filetype)) throw new Error('Invalid format')

  const useScrot = options.linuxLibrary === 'scrot'
  const filename = options.filename ? path.resolve(options.filename) : null
  if (!useScrot && !filename) {
    return capture('import', ['-silent', '-window', 'root', '-crop', screen.crop, '-screen', filetype + ':-'], {
      encoding: 'buffer',
      maxBuffer: maxBuffer(screens)
    })
  }

  // Both tools interpret special strings in output filenames. Capture to a
  // fixed name in a private directory, then copy to the caller's literal path.
  // A file also works with older scrot versions that cannot write to stdout.
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'screenshot-linux-'))
  const output = `capture.${filetype}`
  const imagePath = path.join(dir, output)
  try {
    const args = useScrot
      ? ['-z', output]
      : ['-silent', '-window', 'root', '-crop', screen.crop, '-screen', `${filetype}:${output}`]
    await capture(useScrot ? 'scrot' : 'import', args, { cwd: dir })
    if (filename) {
      await fs.copyFile(imagePath, filename)
      return filename
    }
    return await fs.readFile(imagePath)
  } finally {
    await fs.unlink(imagePath).catch(err => {
      if (err.code !== 'ENOENT') throw err
    })
    await fs.rmdir(dir)
  }
}

linuxSnapshot.listDisplays = listDisplays
linuxSnapshot.parseDisplaysOutput = parseDisplaysOutput
linuxSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT
linuxSnapshot.all = (): Promise<Buffer[]> => defaultAll(linuxSnapshot)
export = linuxSnapshot
