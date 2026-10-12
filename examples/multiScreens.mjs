import path from 'node:path'
import { fileURLToPath } from 'node:url'
import screenshot from '../index.js'

const directory = fileURLToPath(new URL('.', import.meta.url))
const displays = await screenshot.listDisplays()
console.log(displays)

for (const [index, display] of displays.entries()) {
  const filename = path.join(directory, Date.now() + '_' + index + '.png')
  const imgpath = await screenshot({ screen: display.id, filename, format: 'png' })
  console.log(imgpath)
}

for (const display of displays) {
  const imgbuf = await screenshot({ screen: display.id })
  console.log(imgbuf)
}
