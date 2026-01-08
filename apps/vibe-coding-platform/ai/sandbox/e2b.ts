import { CommandHandle, NotFoundError, Sandbox } from 'e2b'

type E2BSandbox = Sandbox
const E2B_LOG_PREFIX = '[e2b]'

function normalizeE2BTemplate(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return 'base'

  // Some docs refer to E2B environments using docker-style names like
  // `e2b/code-interpreter[:tag]`, but the SDK expects the environment/template id.
  if (trimmed.startsWith('e2b/')) {
    const withoutPrefix = trimmed.slice('e2b/'.length)
    const withoutTag = withoutPrefix.split(':')[0] ?? ''
    if (withoutTag) return withoutTag
  }

  return trimmed
}

function getE2BTemplate() {
  return normalizeE2BTemplate(process.env.E2B_TEMPLATE || 'base')
}

function getE2BApiKey() {
  const apiKey = process.env.E2B_API_KEY
  if (!apiKey) {
    throw new Error('Missing required env var: E2B_API_KEY')
  }
  return apiKey
}

export async function createE2BSandbox(params: {
  timeoutMs?: number
}): Promise<{ sandboxId: string; sandbox: E2BSandbox }> {
  const template = getE2BTemplate()
  // console.log(`${E2B_LOG_PREFIX} creating sandbox`, { template })
  const apiKey = getE2BApiKey()
  const sandbox = await Sandbox.create(template, {
    apiKey,
    timeoutMs: params.timeoutMs,
    secure: false,
  })
  console.log(`${E2B_LOG_PREFIX} sandbox created`, {
    sandboxId: sandbox.sandboxId,
  })
  return { sandboxId: sandbox.sandboxId, sandbox }
}

export async function connectE2BSandbox(
  sandboxId: string
): Promise<E2BSandbox> {
  // console.log(`${E2B_LOG_PREFIX} connecting to sandbox`, { sandboxId })
  const apiKey = getE2BApiKey()
  const sandbox = await Sandbox.connect(sandboxId, { apiKey })
  // console.log(`${E2B_LOG_PREFIX} connected to sandbox`, { sandboxId })
  return sandbox
}

export async function e2bRunCommand(params: {
  sandbox: E2BSandbox
  command: string
  args: string[]
}): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { sandbox, command, args } = params
  const cmd = [command, ...args.map(shellEscape)].join(' ')
  console.log(`${E2B_LOG_PREFIX} running command`, {
    sandboxId: sandbox.sandboxId,
    command,
  })
  const result = await sandbox.commands.run(cmd)
  console.log(`${E2B_LOG_PREFIX} command finished`, {
    sandboxId: sandbox.sandboxId,
    command,
    exitCode: result.exitCode,
  })
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  }
}

export async function e2bStartCommand(params: {
  sandbox: E2BSandbox
  command: string
  args: string[]
}): Promise<{ pid: number }> {
  const { sandbox, command, args } = params
  const cmd = [command, ...args.map(shellEscape)].join(' ')
  console.log(`${E2B_LOG_PREFIX} starting background command`, {
    sandboxId: sandbox.sandboxId,
    command,
  })
  const handle = (await sandbox.commands.run(cmd, {
    background: true,
  })) as CommandHandle
  console.log(`${E2B_LOG_PREFIX} background command started`, {
    sandboxId: sandbox.sandboxId,
    command,
    pid: handle.pid,
  })
  await handle.disconnect()
  return { pid: handle.pid }
}

export async function e2bWaitForPort(params: {
  sandbox: E2BSandbox
  port: number
  timeoutMs?: number
  intervalMs?: number
}): Promise<boolean> {
  const { sandbox, port } = params
  const timeoutMs = params.timeoutMs ?? 30_000
  const intervalMs = params.intervalMs ?? 250

  const tries = Math.max(1, Math.ceil(timeoutMs / intervalMs))
  const sleepSeconds = Math.max(0.05, intervalMs / 1000)

  const script = [
    `set -euo pipefail`,
    `for _ in $(seq 1 ${tries}); do`,
    `  if ss -tuln | grep -qE '[:.]${port}\\\\b'; then exit 0; fi`,
    `  sleep ${sleepSeconds}`,
    `done`,
    `exit 1`,
  ].join('\n')

  const result = await sandbox.commands.run(`bash -lc ${shellEscape(script)}`)
  return result.exitCode === 0
}

export async function e2bWriteFile(params: {
  sandbox: E2BSandbox
  path: string
  content: string | Uint8Array
}) {
  const { sandbox, path, content } = params
  let data: string | ArrayBuffer
  if (typeof content === 'string') {
    data = content
  } else if (content.buffer instanceof ArrayBuffer) {
    data = content.buffer.slice(
      content.byteOffset,
      content.byteOffset + content.byteLength
    )
  } else {
    data = Uint8Array.from(content).buffer
  }

  await sandbox.files.write(path, data)
}

export async function e2bReadFile(params: {
  sandbox: E2BSandbox
  path: string
}): Promise<Uint8Array | null> {
  const { sandbox, path } = params
  try {
    return await sandbox.files.read(path, { format: 'bytes' })
  } catch (error) {
    if (error instanceof NotFoundError) return null
    throw error
  }
}

export async function e2bMkdirp(params: { sandbox: E2BSandbox; dir: string }) {
  const { sandbox, dir } = params
  await sandbox.files.makeDir(dir)
}

export function shellEscape(value: string) {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`
}
