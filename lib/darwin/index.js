const Promise = require('pinkie-promise')
const exec = require('child_process').exec
const temp = require('temp')
const fs = require('fs')
const utils = require('../utils')
const path = require('path')

const { unlinkP, readAndUnlinkP } = utils

function darwinSnapshot (options = {}) {
  return new Promise((resolve, reject) => {
    const displayId = options.screen || 0
    if (!Number.isInteger(displayId) || displayId < 0) {
      return reject(new Error(`Invalid choice of displayId: ${displayId}`))
    }

    let suffix = '.jpg'
    let filename
    if (options.filename) {
      const ix = options.filename.lastIndexOf('.')
      suffix = ix >= 0 ? options.filename.slice(ix) : '.jpg'
      filename = '"' + options.filename.replace(/"/g, '\\"') + '"'
    }

    const tmpPaths = Array(displayId + 1)
      .fill(null)
      .map(() => temp.path({ suffix }))

    let pathsToDelete = tmpPaths
    if (options.filename) {
      tmpPaths[displayId] = filename
      pathsToDelete = tmpPaths.slice(0, -1)
    }

    exec('screencapture -x -t ' + suffix.slice(1) + ' ' + tmpPaths.join(' '),
      function (err, stdOut) {
        if (err) {
          return reject(err)
        } else if (options.filename) {
          Promise.all(pathsToDelete.map(unlinkP))
            .then(() => resolve(path.resolve(options.filename)))
            .catch((err) => reject(err))
        } else {
          fs.readFile(tmpPaths[displayId], function (err, img) {
            if (err) {
              return reject(err)
            }
            Promise.all(pathsToDelete.map(unlinkP))
              .then(() => resolve(img))
              .catch((err) => reject(err))
          })
        }
      })
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

function extractEntries (output) {
  let entries = []

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

function makeSubtree (currIndent, subtree, entries) {
  let entry
  while ((entry = entries.shift())) {
    if (entry.value === '') {
      if (currIndent < entry.indent) {
        subtree[entry.key] = {}
        makeSubtree(entry.indent, subtree[entry.key], entries)
      } else {
        entries.unshift(entry)
        return
      }
    } else {
      subtree[entry.key] = entry.value
    }
  }
}

function movePrimaryToHead (displays) {
  const primary = displays.filter(e => e.primary)
  const notPrimary = displays.filter(e => !e.primary)
  return [...primary, ...notPrimary]
}

function addId (displays) {
  let id = 0
  return displays
    .map(display => {
      return Object.assign({}, display, { id: id++ })
    })
}

function parseDisplaysOutput (output) {
  const tree = {}
  makeSubtree(-1, tree, extractEntries(output))

  if (!tree['Graphics/Displays']) {
    return []
  }

  const firstGpuKey = Object.keys(tree['Graphics/Displays'])[0]
  if (!firstGpuKey) {
    return []
  }

  const firstGpu = tree['Graphics/Displays'][firstGpuKey]
  if (!firstGpu) {
    return []
  }

  const displays = Object.entries(firstGpu['Displays'])
    .map(([name, props]) => {
      const primary = props['Main Display'] === 'Yes'
      return { name, primary }
    })

  return addId(movePrimaryToHead(displays))
}

function listDisplays () {
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

function all () {
  return new Promise((resolve, reject) => {
    listDisplays()
      .then((displays) => {
        const tmpPaths = displays.map(() => temp.path({ suffix: '.jpg' }))
        exec('screencapture -x -t jpg ' + tmpPaths.join(' '), {
          cwd: __dirname
        }, function (err, stdOut) {
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

module.exports = darwinSnapshot
