import { connectE2BSandbox, e2bMkdirp, e2bReadFile, e2bWriteFile } from './e2b'

export interface CommandMeta {
  sandboxId: string
  cmdId: string
  startedAt: number
  pid?: number
  exitCode?: number
  triggerRunId?: string
}

const ROOT = '/tmp/vibe-coding-platform'

function cmdDir(cmdId: string) {
  return `${ROOT}/cmds/${cmdId}`
}

function metaPath(cmdId: string) {
  return `${cmdDir(cmdId)}/meta.json`
}

function logsPath(cmdId: string) {
  return `${cmdDir(cmdId)}/logs.ndjson`
}

export async function initCommandArtifacts(params: {
  sandboxId: string
  cmdId: string
  triggerRunId?: string
  pid?: number
}) {
  const sandbox = await connectE2BSandbox(params.sandboxId)
  await e2bMkdirp({ sandbox, dir: cmdDir(params.cmdId) })

  const existing = await readCommandMeta({
    sandboxId: params.sandboxId,
    cmdId: params.cmdId,
  })

  const meta: CommandMeta =
    existing ??
    ({
      sandboxId: params.sandboxId,
      cmdId: params.cmdId,
      startedAt: Date.now(),
    } satisfies CommandMeta)

  if (params.triggerRunId && meta.triggerRunId !== params.triggerRunId) {
    meta.triggerRunId = params.triggerRunId
  }

  if (typeof params.pid === 'number' && meta.pid !== params.pid) {
    meta.pid = params.pid
  }

  const writes: Array<Promise<void>> = []
  if (!existing || params.triggerRunId || typeof params.pid === 'number') {
    writes.push(
      e2bWriteFile({
        sandbox,
        path: metaPath(params.cmdId),
        content: JSON.stringify(meta),
      })
    )
  }

  const existingLogs = await e2bReadFile({
    sandbox,
    path: logsPath(params.cmdId),
  })
  if (!existingLogs) {
    writes.push(
      e2bWriteFile({ sandbox, path: logsPath(params.cmdId), content: '' })
    )
  }

  await Promise.all(writes)
}

export async function finalizeCommandArtifacts(params: {
  sandboxId: string
  cmdId: string
  exitCode: number
  stdout: string
  stderr: string
}) {
  const sandbox = await connectE2BSandbox(params.sandboxId)
  await e2bMkdirp({ sandbox, dir: cmdDir(params.cmdId) })

  const meta = await readCommandMeta({
    sandboxId: params.sandboxId,
    cmdId: params.cmdId,
  })

  const updated: CommandMeta = {
    ...(meta ?? {
      sandboxId: params.sandboxId,
      cmdId: params.cmdId,
      startedAt: Date.now(),
    }),
    exitCode: params.exitCode,
  }

  const lines: string[] = []
  if (params.stdout) {
    lines.push(
      JSON.stringify({
        data: params.stdout,
        stream: 'stdout',
        timestamp: Date.now(),
      })
    )
  }
  if (params.stderr) {
    lines.push(
      JSON.stringify({
        data: params.stderr,
        stream: 'stderr',
        timestamp: Date.now(),
      })
    )
  }

  await Promise.all([
    e2bWriteFile({
      sandbox,
      path: metaPath(params.cmdId),
      content: JSON.stringify(updated),
    }),
    e2bWriteFile({
      sandbox,
      path: logsPath(params.cmdId),
      content: lines.join('\n') + (lines.length ? '\n' : ''),
    }),
  ])
}

export async function readCommandMeta(params: {
  sandboxId: string
  cmdId: string
}): Promise<CommandMeta | null> {
  const sandbox = await connectE2BSandbox(params.sandboxId)
  const raw = await e2bReadFile({ sandbox, path: metaPath(params.cmdId) })
  if (!raw) return null
  try {
    return JSON.parse(Buffer.from(raw).toString('utf8')) as CommandMeta
  } catch {
    return null
  }
}

export async function readCommandLogsNdjson(params: {
  sandboxId: string
  cmdId: string
}): Promise<string | null> {
  const sandbox = await connectE2BSandbox(params.sandboxId)
  const raw = await e2bReadFile({ sandbox, path: logsPath(params.cmdId) })
  if (!raw) return null
  return Buffer.from(raw).toString('utf8')
}
