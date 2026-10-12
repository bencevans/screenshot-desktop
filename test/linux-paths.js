const test = require('ava')
const fs = require('fs')
const os = require('os')
const path = require('path')
const screenshot = require('../')
const nativeTest = process.platform === 'linux' ? test.serial : test.skip
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

function checkImage (t, image, format) {
  t.true(Buffer.isBuffer(image))
  if (format === 'png') {
    t.deepEqual(image.subarray(0, 8), png)
    t.true(image.readUInt32BE(16) > 0)
    t.true(image.readUInt32BE(20) > 0)
  } else {
    t.deepEqual(image.subarray(0, 2), Buffer.from([255, 216]))
  }
}

for (const linuxLibrary of ['scrot', 'imagemagick']) {
  for (const format of ['png', 'jpeg']) {
    nativeTest(`${linuxLibrary} captures a ${format} Buffer without a filename`, async t => {
      checkImage(t, await screenshot({ linuxLibrary, format }), format)
    })
  }

  nativeTest(`${linuxLibrary} saves exact filenames through paths with special characters`, async t => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linux path café 路径 %Y $f & (test)-'))
    const filenames = [
      'desktop image.png', 'café 路径.png', 'desktop & (image).png',
      'desktop "quoted" \'single\'.png', 'desktop %Y $f.png',
      'desktop; touch INJECTION_MARKER.png', 'desktop$(touch INJECTION_MARKER).png',
      'desktop`touch INJECTION_MARKER`.png', 'desktop\nimage.png', '-desktop.png'
    ]
    try {
      for (const filename of filenames) {
        const output = path.join(dir, filename)
        const relative = path.relative(process.cwd(), output)
        t.is(await screenshot({ linuxLibrary, filename: relative, format: 'png' }), output)
        checkImage(t, fs.readFileSync(output), 'png')
      }
      const absolute = path.join(dir, 'absolute %Y $f image.png')
      t.is(await screenshot({ linuxLibrary, filename: absolute }), absolute)
      checkImage(t, fs.readFileSync(absolute), 'png')
      const noExtension = path.join(dir, 'no extension')
      t.is(await screenshot({ linuxLibrary, filename: noExtension, format: 'jpeg' }), noExtension)
      checkImage(t, fs.readFileSync(noExtension), 'jpeg')
      t.false(fs.existsSync(path.join(dir, 'INJECTION_MARKER')))
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
}
