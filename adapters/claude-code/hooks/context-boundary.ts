// Shared by the sandboxed Claude mod and Pi. Shell compounds are deliberately
// left alone: a single completed state invocation is an unambiguous boundary.
export function completedStep(command: string, output: string): string | undefined {
  const words: string[] = []
  let word = '', quote = '', active = false
  for (let i = 0; i < command.length; i++) {
    const c = command[i]
    if (quote) {
      if (c === quote) quote = ''
      else if (c === '\\' && quote === '"') word += command[++i] ?? ''
      else word += c
    } else if (c === "'" || c === '"') { quote = c; active = true }
    else if (c === '\\') { word += command[++i] ?? ''; active = true }
    else if (/\s/.test(c)) { if (active) words.push(word); word = ''; active = false }
    else if (/[;&|<>`$()]/.test(c)) return
    else { word += c; active = true }
  }
  if (quote) return
  if (active) words.push(word)
  if (words[0] === 'node') words.shift()
  const script = words.shift()
  if (!script || !/(?:^|\/)scripts\/state$/.test(script)) return
  if (!words.shift()) return
  const action = words.shift()
  if (action !== 'step' && action !== 'deliver') return
  const args: string[] = []
  while (words.length) {
    const arg = words.shift()!
    if (arg === '--main-session' || arg === '--user-approved') continue
    if (arg.startsWith('--')) { if (!words.length) return; words.shift() }
    else args.push(arg)
  }
  if (action === 'step' && (args.length !== 2 || args[1] !== 'done')) return
  if (action === 'deliver' && (args.length < 1 || args.length > 2 || !/^done: /m.test(output))) return
  if (!output.split('\n').some(line => line.startsWith(`state: ${action} ${args.join(' ')} → workflow `))) return
  return script.replace(/state$/, 'context-threshold')
}

export function contextLine(tokens: number | null | undefined, window: number, threshold: number): string | undefined {
  if (!Number.isInteger(tokens) || tokens! < 0 || !Number.isFinite(window) || window <= 0 ||
      !Number.isInteger(threshold) || threshold <= 0 || tokens! < threshold) return
  // Exact counts keep both the threshold and the 80% recommendation unambiguous.
  return `context: ${tokens} of ${window} window, threshold ${threshold}`
}

// The bridge exits 1 naming an unreadable user configuration: its first error, as a line the
// router reports, so the threshold is never silently taken for the default.
export function configLine(stderr: string | undefined): string | undefined {
  const error = (stderr ?? '').split('\n').find(line => line.startsWith('error: '))
  return error ? `config: ${error}` : undefined
}
