import fs = require('fs')
import os = require('os')
import path = require('path')
import type { Buffer } from 'buffer'
import type { Display, Screenshot } from './types'

/**
 * Delete a file, rejecting if the filesystem cannot remove it.
 * @param path - File to remove.
 */
export function unlinkP(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(path, function (err) {
      if (err) {
        return reject(err)
      }
      return resolve()
    })
  })
}

/**
 * Read a file as a Buffer without changing it.
 * @param path - File to read.
 */
export function readFileP(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, function (err, img) {
      if (err) {
        return reject(err)
      }
      resolve(img)
    })
  })
}

/**
 * Read a file, then remove it before returning its bytes.
 * A failed read leaves the file in place; a failed removal rejects the operation.
 * @param path - Capture file to consume.
 */
export function readAndUnlinkP(path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    readFileP(path)
      .then(img => {
        unlinkP(path)
          .then(() => {
            resolve(img)
          })
          .catch(err => {
            reject(err)
          })
      })
      .catch(err => {
        reject(err)
      })
  })
}

/**
 * Capture detected displays concurrently, preserving their discovery order.
 * Returns an empty array when discovery finds no displays.
 * @param snapshot - Platform implementation used for discovery and capture.
 */
export function defaultAll<D extends Display>(snapshot: Screenshot<D>): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    snapshot
      .listDisplays()
      .then(displays => {
        const snapsP = displays.map(({ id }) => snapshot({ screen: id }))
        Promise.all(snapsP).then(resolve).catch(reject)
      })
      .catch(reject)
  })
}

/**
 * Run an operation in a private directory and remove it on success or failure.
 * Await all work using the directory before the operation resolves.
 * Cleanup errors reject the call, including when the operation also fails.
 * @param prefix - Prefix for the randomly generated directory name.
 * @param operation - Work that owns all intermediate files in the directory.
 * @param parent - Existing directory to create the private directory inside.
 * @returns The operation's result after cleanup completes.
 */
export async function withTemporaryDirectory<T>(
  prefix: string,
  operation: (directory: string) => Promise<T>,
  parent = os.tmpdir()
): Promise<T> {
  const directory = await fs.promises.mkdtemp(path.join(parent, prefix))
  try {
    return await operation(directory)
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true })
  }
}
