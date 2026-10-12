import * as fs from 'fs'
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

