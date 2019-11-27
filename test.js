import test from 'ava'
import { tmpNameSync } from 'tmp'
import { existsSync, unlinkSync } from 'fs'
import screenshot from './'

test('screenshot', t => {
  t.plan(1)
  return screenshot().then(img => {
    t.truthy(Buffer.isBuffer(img))
  })
})

function checkDisplays (t, displays) {
  t.truthy(Array.isArray(displays))
  displays.forEach(disp => {
    t.truthy(disp.name)
    t.truthy(disp.id !== undefined)
  })
}

test('screenshot each display', t => {
  if (screenshot.availableDisplays) {
    return screenshot.availableDisplays().then(displays => {
      checkDisplays(t, displays)

      displays.forEach(display => {
        screenshot(display.id)
      })
    })
  } else {
    t.pass()
  }
})

test('screenshot to a file', t => {
  t.plan(1)
  const tmpName = tmpNameSync({ postfix: '.jpg' })
  return screenshot({ filename: tmpName }).then(() => {
    t.truthy(existsSync(tmpName))
    unlinkSync(tmpName)
  })
})

test('screenshot specific screen to a file', t => {
  t.plan(1)
  const tmpName = tmpNameSync()
  return screenshot({ filename: tmpName, screen: 0 }).then(() => {
    t.truthy(existsSync(tmpName))
    unlinkSync(tmpName)
  })
})

test('screenshot to a file with a space', t => {
  // https://github.com/bencevans/screenshot-desktop/issues/12
  t.plan(1)
  const tmpName = tmpNameSync({ prefix: 'sd ', postfix: '.jpg' })
  return screenshot({ filename: tmpName }).then(() => {
    t.truthy(existsSync(tmpName))
    unlinkSync(tmpName)
  })
})

test('parse display output', t => {
  if (screenshot.EXAMPLE_DISPLAYS_OUTPUT && screenshot.parseDisplaysOutput) {
    const disps = screenshot.parseDisplaysOutput(screenshot.EXAMPLE_DISPLAYS_OUTPUT)
    checkDisplays(t, disps)
  }
})
