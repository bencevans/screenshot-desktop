const screenshot = require('../')
const fs = require('fs/promises')

async function main () {
  try {
    const img = await screenshot()
    await fs.writeFile('out.jpg', img)
    console.log('written to out.jpg')
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  }
}

main()
