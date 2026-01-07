import { task } from '@trigger.dev/sdk/v3'
import { e2bRunCommand, connectE2BSandbox } from '../ai/sandbox/e2b'
import {
  finalizeCommandArtifacts,
  initCommandArtifacts,
} from '../ai/sandbox/command-store'

const TRIGGER_LOG_PREFIX = '[trigger]'

export const e2bRunCommandTask = task({
  id: 'e2b-run-command',
  run: async (
    payload: {
      sandboxId: string
      cmdId: string
      command: string
      args?: string[]
      sudo?: boolean
    },
    { ctx }
  ) => {
    console.log(`${TRIGGER_LOG_PREFIX} task started`, {
      taskId: 'e2b-run-command',
      triggerRunId: ctx.run.id,
      sandboxId: payload.sandboxId,
      cmdId: payload.cmdId,
      command: payload.command,
      sudo: Boolean(payload.sudo),
    })
    const args = payload.args ?? []
    const cmd = payload.sudo ? 'sudo' : payload.command
    const cmdArgs = payload.sudo ? [payload.command, ...args] : args

    await initCommandArtifacts({
      sandboxId: payload.sandboxId,
      cmdId: payload.cmdId,
      triggerRunId: ctx.run.id,
    })
    console.log(`${TRIGGER_LOG_PREFIX} artifacts initialized`, {
      triggerRunId: ctx.run.id,
      sandboxId: payload.sandboxId,
      cmdId: payload.cmdId,
    })

    const sandbox = await connectE2BSandbox(payload.sandboxId)
    console.log(`${TRIGGER_LOG_PREFIX} connected to e2b sandbox`, {
      triggerRunId: ctx.run.id,
      sandboxId: payload.sandboxId,
    })
    const { stdout, stderr, exitCode } = await e2bRunCommand({
      sandbox,
      command: cmd,
      args: cmdArgs,
    })
    console.log(`${TRIGGER_LOG_PREFIX} command completed`, {
      triggerRunId: ctx.run.id,
      sandboxId: payload.sandboxId,
      cmdId: payload.cmdId,
      exitCode,
    })

    await finalizeCommandArtifacts({
      sandboxId: payload.sandboxId,
      cmdId: payload.cmdId,
      exitCode,
      stdout,
      stderr,
    })
    console.log(`${TRIGGER_LOG_PREFIX} artifacts finalized`, {
      triggerRunId: ctx.run.id,
      sandboxId: payload.sandboxId,
      cmdId: payload.cmdId,
    })

    return { exitCode }
  },
})
