import type { ScreenshotOptions, DarwinDisplay } from '../types'
import type { Buffer } from 'buffer'
import childProcess = require('child_process')
import fs = require('fs')
import * as utils from '../utils'
import path = require('path')

const { exec } = childProcess
const temp: { path(options: { suffix: string }): string } = require('temp')
const { unlinkP, readAndUnlinkP } = utils

function darwinSnapshot (options: ScreenshotOptions & { filename: '' }): Promise<Buffer>
function darwinSnapshot (options: ScreenshotOptions & { filename: string }): Promise<string>
function darwinSnapshot (options?: ScreenshotOptions & { filename?: undefined }): Promise<Buffer>
function darwinSnapshot (options: ScreenshotOptions): Promise<Buffer | string>
function darwinSnapshot (options: ScreenshotOptions = {}): Promise<Buffer | string> {
  const performScreenCapture = (displays: DarwinDisplay[]) => new Promise<Buffer | string>((resolve, reject) => {
    // validate displayId
    const totalDisplays = displays.length
    if (totalDisplays === 0 && options.screen !== undefined) {
      return reject(new Error('No displays detected try dropping screen option'))
    }
    // macOS VMs can have a working desktop without system_profiler metadata.
    // Let screencapture capture the default display when none was requested.
    const maxDisplayId = Math.max(totalDisplays - 1, 0)
    const displayId = options.screen || 0
    if (!Number.isInteger(displayId) || typeof displayId !== 'number' || displayId < 0 || displayId > maxDisplayId) {
      const validChoiceMsg = (maxDisplayId === 0) ? '(valid choice is 0 or drop screen option altogether)' : `(valid choice is an integer between 0 and ${maxDisplayId})`
      return reject(new Error(`Invalid choice of displayId: ${displayId} ${validChoiceMsg}`))
    }

    // Validate format
    const allowedFormats = ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'gif', 'pdf']
    const format = (options.format || 'jpg').toLowerCase()
    if (!allowedFormats.includes(format)) {
      return reject(new Error('Invalid format'))
    }

    // Resolve filenames before passing them as a literal execFile argument.
    let filename = ''
    let suffix: string
    if (options.filename) {
      // An absolute path also prevents leading hyphens being read as options.
      filename = path.resolve(options.filename)
      suffix = path.extname(filename) || `.${format}`
    } else {
      suffix = `.${format}`
    }

    const tmpPaths = Array(displayId + 1)
      .fill(null)
      .map(() => temp.path({ suffix }))

    let pathsToUse: string[] = []
    if (options.filename) {
      tmpPaths[displayId] = filename
    }
    pathsToUse = tmpPaths.slice(0, displayId + 1)

    // Use execFile for safe argument passing
    const args = ['-x', '-t', format, ...pathsToUse]
    childProcess.execFile('screencapture', args, function (err, stdOut) {
      if (err) {
        return reject(err)
      } else if (options.filename) {
        resolve(path.resolve(filename))
      } else {
        fs.readFile(tmpPaths[displayId], function (err, img) {
          if (err) {
            return reject(err)
          }
          Promise.all(pathsToUse.map(unlinkP))
            .then(() => resolve(img))
            .catch((err) => reject(err))
        })
      }
    })
  })

  return listDisplays().then((displays) => { return performScreenCapture(displays) })
}

const EXAMPLE_DISPLAYS_OUTPUT = `
Graphics/Displays:

    Intel Iris:

      Chipset Model: Intel Iris
      Type: GPU
      Bus: Built-In
      VRAM (Dynamic, Max): 1536 MB
      Vendor: Intel (0x8086)
      Device ID: 0x0a2e
      Revision ID: 0x0009
      Displays:
        Color LCD:
          Display Type: Retina LCD
          Resolution: 2560 x 1600 Retina
          Retina: Yes
          Pixel Depth: 32-Bit Color (ARGB8888)
          Main Display: Yes
          Mirror: Off
          Online: Yes
          Built-In: Yes
        HP 22cwa:
          Resolution: 1920 x 1080 @ 60Hz (1080p)
          Pixel Depth: 32-Bit Color (ARGB8888)
          Display Serial Number: 6CM7201231
          Mirror: Off
          Online: Yes
          Rotation: Supported
          Television: Yes
`

interface Entry {
  indent: number
  key: string
  value: string
}

interface Tree {
  [key: string]: string | Tree
}

function extractEntries (output: string): Entry[] {
  const entries: Entry[] = []

  const entryPattern = /(\s*)(.*?):(.*)\n/g
  let match
  while ((match = entryPattern.exec(output)) !== null) {
    entries.push({
      indent: match[1].length,
      key: match[2].trim(),
      value: match[3].trim()
    })
  }

  return entries
}

function makeSubtree (currIndent: number, subtree: Tree, entries: Entry[]): void {
  let entry
  while ((entry = entries.shift())) {
    if (entry.value === '') {
      if (currIndent < entry.indent) {
        while (entry.key in subtree) {
          entry.key += '_1'
        }
        const child: Tree = {}
        subtree[entry.key] = child
        makeSubtree(entry.indent, child, entries)
      } else {
        entries.unshift(entry)
        return
      }
    } else {
      while (entry.key in subtree) {
        entry.key += '_1'
      }
      subtree[entry.key] = entry.value
    }
  }
}

function movePrimaryToHead (displays: Omit<DarwinDisplay, 'id'>[]) {
  const primary = displays.filter(e => e.primary)
  const notPrimary = displays.filter(e => !e.primary)
  return [...primary, ...notPrimary]
}

function addId (displays: Omit<DarwinDisplay, 'id'>[]): DarwinDisplay[] {
  let id = 0
  return displays
    .map(display => {
      return Object.assign({}, display, { id: id++ })
    })
}

function parseDisplaysOutput (output: string): DarwinDisplay[] {
  const tree: Tree = {}
  makeSubtree(-1, tree, extractEntries(output))

  if (!tree['Graphics/Displays']) {
    return []
  }

  const graphics = tree['Graphics/Displays'] as Tree
  const firstGpuKeys = Object.keys(graphics)
  if (!firstGpuKeys || firstGpuKeys.length <= 0) {
    return []
  }

  let displayinfos: Omit<DarwinDisplay, 'id'>[] = []

  firstGpuKeys.forEach(gpukey => {
    const gpu = graphics[gpukey] as Tree
    if (gpu.Displays) {
      const temp = Object.entries(gpu.Displays as Tree)
        .map(([name, props]) => {
          const primary = (props as Tree)['Main Display'] === 'Yes'
          return { name, primary }
        })
      displayinfos = displayinfos.concat(temp)
    }
  })

  return addId(movePrimaryToHead(displayinfos))
}

function listDisplays (): Promise<DarwinDisplay[]> {
  return new Promise((resolve, reject) => {
    exec(
      'system_profiler SPDisplaysDataType',
      (err, stdout) => {
        if (err) {
          return reject(err)
        }
        resolve(parseDisplaysOutput(stdout))
      })
  })
}

function all (): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    listDisplays()
      .then((displays) => {
        if (displays.length === 0) {
          return darwinSnapshot().then(img => resolve([img]), reject)
        }
        const tmpPaths = displays.map(() => temp.path({ suffix: '.jpg' }))
        exec('screencapture -x -t jpg ' + tmpPaths.join(' '), function (err, stdOut) {
          if (err) {
            return reject(err)
          } else {
            Promise.all(tmpPaths.map(readAndUnlinkP))
              .then(resolve)
              .catch(reject)
          }
        })
      })
  })
}

darwinSnapshot.listDisplays = listDisplays
darwinSnapshot.all = all
darwinSnapshot.parseDisplaysOutput = parseDisplaysOutput
darwinSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT

export = darwinSnapshot
