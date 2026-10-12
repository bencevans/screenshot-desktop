import fs = require('fs')
import os = require('os')
import path = require('path')
import type { Buffer } from 'buffer'
import type { Display, Screenshot } from './types'

export function unlinkP (path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(path, function (err) {
      if (err) {
        return reject(err)
      }
      return resolve()
    })
  })
}

export function readFileP (path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    fs.readFile(path, function (err, img) {
      if (err) {
        return reject(err)
      }
      resolve(img)
    })
  })
}

export function readAndUnlinkP (path: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    readFileP(path)
      .then((img) => {
        unlinkP(path)
          .then(() => {
            resolve(img)
          })
          .catch((err) => {
            reject(err)
          })
      })
      .catch((err) => {
        reject(err)
      })
  })
}

export function defaultAll<D extends Display> (snapshot: Screenshot<D>): Promise<Buffer[]> {
  return new Promise((resolve, reject) => {
    snapshot.listDisplays()
      .then((displays) => {
        const snapsP = displays
          .map(({ id }) => snapshot({ screen: id }))
        Promise.all(snapsP)
          .then(resolve)
          .catch(reject)
      })
      .catch(reject)
  })
}

/** Own every intermediate file in one private directory, including partial output. */
export async function withTemporaryDirectory<T> (prefix: string, operation: (directory: string) => Promise<T>, parent = os.tmpdir()): Promise<T> {
  const directory = await fs.promises.mkdtemp(path.join(parent, prefix))
  try {
    return await operation(directory)
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true })
  }
}
