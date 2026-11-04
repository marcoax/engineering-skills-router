import { expect, test } from 'claude-code/testing'

const command = '"/router checkout/scripts/state" "/target repo" step 2 done --outcome "branch ready"'
const stdout = 'state: step 2 done → workflow running\n'

test('Claude reports context after a successful router step closes', async ($, on) => {
  on('tool.call', {tool: 'Bash'}, () => ({result: {stdout, stderr: '', interrupted: false, extra: 'kept'}}) as any)
  on('process.run', (_, e) => {
    expect(e.argv).toEqual(['node', '/router checkout/scripts/context-threshold'])
    return {value: {exitCode: 0, stdout: '150000\n', stderr: ''}}
  })
  on('session.usage', () => ({value: {context: {tokens: 162000, window: 200000}}}) as any)
  const result: any = await $.tool.call({tool: 'Bash', command} as any)
  expect(result.result.stdout).toBe(stdout + 'context: 162000 of 200000 window, threshold 150000\n')
  expect(result.result.extra).toBe('kept')
})

for (const [label, threshold, tokens, expected] of [
  ['inclusive custom threshold', 162000, 162000, 'context: 162000 of 200000 window, threshold 162000\n'],
  ['below threshold', 170000, 162000, ''],
  ['disabled', 0, 190000, ''],
  ['unknown tokens', 150000, undefined, ''],
] as const) {
  test(`Claude boundary: ${label}`, async ($, on) => {
    on('tool.call', {tool: 'Bash'}, () => ({result: {stdout, stderr: 'kept', interrupted: false}, context: ['kept context'], isReadOnly: true}) as any)
    on('process.run', () => ({value: {exitCode: 0, stdout: String(threshold), stderr: ''}}))
    on('session.usage', () => ({value: {context: {tokens, window: 200000}}}) as any)
    const result: any = await $.tool.call({tool: 'Bash', command} as any)
    expect(result.result.stdout).toBe(stdout + expected)
    expect(result.result.stderr).toBe('kept')
    expect(result.context).toEqual(['kept context'])
  })
}

for (const [label, result] of [
  ['error', {result: {stdout, stderr: 'failed', interrupted: false}, isError: true}],
  ['denied', {deny: 'permission'}],
  ['interrupted', {result: {stdout, stderr: '', interrupted: true}}],
  ['background task', {result: {stdout, stderr: '', interrupted: false, backgroundTaskId: 'task'}}],
] as const) {
  test(`Claude leaves ${label} alone`, async ($, on) => {
    on('tool.call', {tool: 'Bash'}, () => result as any)
    const actual: any = await $.tool.call({tool: 'Bash', command} as any)
    expect(actual).toEqual(result)
  })
}

test('Claude keeps a successful step when measurement fails', async ($, on) => {
  on('tool.call', {tool: 'Bash'}, () => ({result: {stdout, stderr: '', interrupted: false}}) as any)
  on('process.run', () => ({value: {exitCode: 0, stdout: '150000', stderr: ''}}))
  on('session.usage', () => {throw new Error('usage unavailable')})
  const result: any = await $.tool.call({tool: 'Bash', command} as any)
  expect(result.result.stdout).toBe(stdout)
})

// A configuration the bridge cannot read is reported after the step, never taken for the default.
test('Claude reports an unreadable configuration after a completed step', async ($, on) => {
  on('tool.call', {tool: 'Bash'}, () => ({result: {stdout, stderr: '', interrupted: false}}) as any)
  on('process.run', () => ({value: {exitCode: 1, stdout: '', stderr: 'error: /cfg/preferences.yaml: malformed YAML: x\nThe user configuration in effect cannot be read: fix it.\n'}}))
  on('session.usage', () => ({value: {context: {tokens: 190000, window: 200000}}}) as any)
  const result: any = await $.tool.call({tool: 'Bash', command} as any)
  expect(result.result.stdout).toBe(stdout + 'config: error: /cfg/preferences.yaml: malformed YAML: x\n')
})
