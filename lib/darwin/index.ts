import type { ScreenshotOptions, DarwinDisplay } from '../types'
import type { Buffer } from 'buffer'
import childProcess = require('child_process')
import fs = require('fs')
import utils = require('../utils')
import path = require('path')

const { exec } = childProcess
const { withTemporaryDirectory } = utils

/**
 * Capture a macOS display with screencapture.
 * Returns image bytes, or the absolute path when a nonempty filename is supplied.
 * The default display can be captured even if discovery returns no metadata.
 * @param options - Output format, destination and zero-based display ID.
 */
function darwinSnapshot(options: ScreenshotOptions & { filename: '' }): Promise<Buffer>
function darwinSnapshot<const F extends string>(
  options: Omit<ScreenshotOptions, 'filename'> & { filename: F }
): Promise<F extends '' ? Buffer : string extends F ? Buffer | string : string>
function darwinSnapshot(options?: ScreenshotOptions & { filename?: undefined }): Promise<Buffer>
function darwinSnapshot(options: ScreenshotOptions): Promise<Buffer | string>
function darwinSnapshot(options: ScreenshotOptions = {}): Promise<Buffer | string> {
  /**
   * Validate the requested display and format, then capture with private scratch files.
   */
  const performScreenCapture = async (displays: DarwinDisplay[]): Promise<Buffer | string> => {
    // validate displayId
    const totalDisplays = displays.length
    if (totalDisplays === 0 && options.screen !== undefined) {
      throw new Error('No displays detected try dropping screen option')
    }
    // macOS VMs can have a working desktop without system_profiler metadata.
    // Let screencapture capture the default display when none was requested.
    const maxDisplayId = Math.max(totalDisplays - 1, 0)
    const displayId = options.screen || 0
    if (
      !Number.isInteger(displayId) ||
      typeof displayId !== 'number' ||
      displayId < 0 ||
      displayId > maxDisplayId
    ) {
      const validChoiceMsg =
        maxDisplayId === 0
          ? '(valid choice is 0 or drop screen option altogether)'
          : `(valid choice is an integer between 0 and ${maxDisplayId})`
      throw new Error(`Invalid choice of displayId: ${displayId} ${validChoiceMsg}`)
    }

    // Validate format
    const allowedFormats = ['jpg', 'jpeg', 'png', 'tiff', 'bmp', 'gif', 'pdf']
    const format = (options.format || 'jpg').toLowerCase()
    if (!allowedFormats.includes(format)) {
      throw new Error('Invalid format')
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

    return withTemporaryDirectory('screenshot-darwin-', async directory => {
      const tmpPaths = Array.from({ length: displayId + 1 }, (_, index) =>
        path.join(directory, `capture-${index}${suffix}`)
      )
      if (options.filename) tmpPaths[displayId] = filename
      await capture(['-x', '-t', format, ...tmpPaths])
      return options.filename ? filename : fs.promises.readFile(tmpPaths[displayId])
    })
  }

  return listDisplays().then(displays => {
    return performScreenCapture(displays)
  })
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

/**
 * One indented key/value record from system_profiler output.
 */
interface Entry {
  indent: number
  key: string
  value: string
}

/**
 * Nested system_profiler sections and their scalar properties.
 */
interface Tree {
  [key: string]: string | Tree
}

/**
 * Split system_profiler output into key/value records with their indentation.
 */
function extractEntries(output: string): Entry[] {
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

/**
 * Consume entries into a nested tree until a sibling section is reached.
 * Mutates both the tree and entry queue; duplicate section keys receive a suffix.
 * @param currIndent - Indentation of the current section.
 * @param subtree - Destination for properties and child sections.
 * @param entries - Remaining records, consumed from the front.
 */
function makeSubtree(currIndent: number, subtree: Tree, entries: Entry[]): void {
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

/**
 * Place the primary display first while preserving order within each group.
 */
function movePrimaryToHead(displays: Omit<DarwinDisplay, 'id'>[]) {
  const primary = displays.filter(e => e.primary)
  const notPrimary = displays.filter(e => !e.primary)
  return [...primary, ...notPrimary]
}

/**
 * Assign zero-based IDs in capture order after the primary display is moved first.
 */
function addId(displays: Omit<DarwinDisplay, 'id'>[]): DarwinDisplay[] {
  let id = 0
  return displays.map(display => {
    return Object.assign({}, display, { id: id++ })
  })
}

/**
 * Extract displays across GPUs from system_profiler and assign capture IDs.
 * Returns an empty array when display metadata is unavailable.
 */
function parseDisplaysOutput(output: string): DarwinDisplay[] {
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
      const temp = Object.entries(gpu.Displays as Tree).map(([name, props]) => {
        const primary = (props as Tree)['Main Display'] === 'Yes'
        return { name, primary }
      })
      displayinfos = displayinfos.concat(temp)
    }
  })

  return addId(movePrimaryToHead(displayinfos))
}

/**
 * Discover macOS displays using system_profiler; command failures reject the call.
 */
function listDisplays(): Promise<DarwinDisplay[]> {
  return new Promise((resolve, reject) => {
    exec('system_profiler SPDisplaysDataType', (err, stdout) => {
      if (err) {
        return reject(err)
      }
      resolve(parseDisplaysOutput(stdout))
    })
  })
}

/**
 * Run screencapture with literal arguments, resolving once file output is complete.
 */
function capture(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    childProcess.execFile('screencapture', args, err => (err ? reject(err) : resolve()))
  })
}

/**
 * Capture all macOS displays in one screencapture invocation and return JPG buffers.
 * If discovery is empty, capture the default display as a one-element array.
 */
async function all(): Promise<Buffer[]> {
  const displays = await listDisplays()
  if (displays.length === 0) return [await darwinSnapshot()]
  return withTemporaryDirectory('screenshot-darwin-', async directory => {
    const paths = displays.map((_, index) => path.join(directory, `capture-${index}.jpg`))
    await capture(['-x', '-t', 'jpg', ...paths])
    return Promise.all(paths.map(filename => fs.promises.readFile(filename)))
  })
}

darwinSnapshot.listDisplays = listDisplays
darwinSnapshot.all = all
darwinSnapshot.parseDisplaysOutput = parseDisplaysOutput
darwinSnapshot.EXAMPLE_DISPLAYS_OUTPUT = EXAMPLE_DISPLAYS_OUTPUT

export = darwinSnapshot
