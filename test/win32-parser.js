const test = require('ava')
const { parseDisplaysOutput, EXAMPLE_DISPLAYS_OUTPUT } = require('../lib/win32')

const id = '\\\\.\\DISPLAY1'
const record = `${id};0;1920;1080;0;1`
const expected = {
  id,
  name: id,
  top: 0,
  right: 1920,
  bottom: 1080,
  left: 0,
  dpiScale: 1,
  width: 1920,
  height: 1080
}

for (const separator of ['\r\n', '\n', '\r']) {
  test(`parses headerless records with ${JSON.stringify(separator)} line endings`, t => {
    t.deepEqual(parseDisplaysOutput(record + separator), [expected])
  })
}

test('ignores echoes, localized diagnostics and surrounding whitespace', t => {
  const output = `diagnostic text\nC:\\cache with spaces>// 2>nul ||\n ${id} ; 0 ; 1920 ; 1080 ; 0 ; 1 \ncompilation warning\n`
  t.deepEqual(parseDisplaysOutput(output), [expected])
})

test('preserves monitor order, negative bounds and comma DPI', t => {
  const secondId = '\\\\.\\DISPLAY2'
  t.deepEqual(parseDisplaysOutput(`${record}\n${secondId};-1080;0;0;-1920;1,25`), [
    expected,
    { id: secondId, name: secondId, top: -1080, right: 0, bottom: 0, left: -1920, dpiScale: 1.25, width: 1920, height: 1080 }
  ])
})

test('the published example contains complete display records', t => {
  t.is(parseDisplaysOutput(EXAMPLE_DISPLAYS_OUTPUT).length, 2)
})

for (const output of ['', 'helper failed', `prefix ${record}`, `${id}&echo unsafe;0;1920;1080;0;1`]) {
  test(`rejects output without valid display IDs: ${JSON.stringify(output)}`, t => {
    t.throws(() => parseDisplaysOutput(output), { message: 'No Windows display records found in screenshot helper output' })
  })
}

for (const fields of [
  '0;1920;1080;0',
  '0;1920;1080;0;1;extra',
  '0;1920px;1080;0;1',
  '0;1920;1080;0;1suffix',
  '0;1920;1080;0;0',
  '0;1920;1080;0;Infinity',
  '0;0;1080;0;1',
  '1080;1920;0;0;1',
  '0;9007199254740992;1080;0;1'
]) {
  test(`rejects malformed display fields: ${fields}`, t => {
    t.throws(() => parseDisplaysOutput(`${record}\n${id};${fields}`), { message: /Invalid Windows display/ })
  })
}
