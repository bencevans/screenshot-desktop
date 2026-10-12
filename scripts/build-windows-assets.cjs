const fs = require('fs')
const path = require('path')

const directory = path.join(__dirname, '..', 'lib', 'win32')
const assets = [
  ['bat', 'screenCapture_1.3.3.bat'],
  ['manifest', 'app.manifest']
]
const source = '// Generated from the Windows helper files by scripts/build-windows-assets.cjs.\n' +
  assets.map(([name, filename]) => {
    const data = fs.readFileSync(path.join(directory, filename)).toString('base64')
    return `export const ${name}: string = ${JSON.stringify(data)}\n`
  }).join('')
fs.writeFileSync(path.join(directory, 'assets.ts'), source)
