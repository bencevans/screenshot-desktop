import screenshot from '../index.js'
import { writeFile } from 'node:fs/promises'

const img = await screenshot()
await writeFile('out.jpg', img)
console.log('written to out.jpg')
