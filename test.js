import test from 'ava'
import screenshot from './'
import { isBuffer } from 'util'

test(t => {
  t.plan(1)
  return screenshot().then(img => {
    t.truthy(isBuffer(img))
  })
})

function checkDisplays(t, displays) {
  t.truthy(Array.isArray(displays))
  displays.forEach(disp => {
    t.truthy(disp.name)
    t.truthy(disp.id !== undefined)
  })
}

test(t => {
  if (screenshot.availableDisplays) {
    return screenshot.availableDisplays().then(displays => {
      checkDisplays(t, displays)

      displays.forEach(display => {
        screenshot(display.id)
      })
    })
  }
});

test(t => {
  if (screenshot.EXAMPLE_DISPLAYS_OUTPUT && screenshot.parseDisplaysOutput) {
    const disps = screenshot.parseDisplaysOutput(screenshot.EXAMPLE_DISPLAYS_OUTPUT)
    checkDisplays(t, disps)
  }
})
