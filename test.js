import test from 'ava'
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
  }
})

test('parse display output', t => {
  if (screenshot.EXAMPLE_DISPLAYS_OUTPUT && screenshot.parseDisplaysOutput) {
    const disps = screenshot.parseDisplaysOutput(screenshot.EXAMPLE_DISPLAYS_OUTPUT)
    checkDisplays(t, disps)
  }
})
