const path = require('path')
const screenshot = require('..')

async function main () {
  try {
    const displays = await screenshot.listDisplays()
    console.log(displays)

    for (const [index, display] of displays.entries()) {
      const filename = path.join(__dirname, Date.now() + '_' + index + '.png')
      const imgpath = await screenshot({ screen: display.id, filename, format: 'png' })
      console.log(imgpath)
    }

    for (const display of displays) {
      const imgbuf = await screenshot({ screen: display.id })
      console.log(imgbuf)
    }
  } catch (err) {
    console.error(err)
    process.exitCode = 1
  }
}

main()
