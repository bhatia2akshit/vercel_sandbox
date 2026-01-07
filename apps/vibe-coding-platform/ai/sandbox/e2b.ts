import { NotFoundError, Sandbox } from 'e2b'

type E2BSandbox = Sandbox
const E2B_LOG_PREFIX = '[e2b]'

function getE2BTemplate() {
  return process.env.E2B_TEMPLATE || 'base'
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
