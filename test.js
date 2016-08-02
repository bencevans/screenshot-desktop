import test from 'ava'
import screenshot from './'
import { isBuffer } from 'util'

test(t => {
  t.plan(1)
  return screenshot().then(img => {
    t.truthy(isBuffer(img))
  })
})

