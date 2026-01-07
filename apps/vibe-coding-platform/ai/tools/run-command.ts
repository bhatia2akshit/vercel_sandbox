import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getRichError } from './get-rich-error'
import { tool } from 'ai'
import description from './run-command.md'
import z from 'zod/v3'
import { tasks } from '@trigger.dev/sdk/v3'
import { connectE2BSandbox, e2bRunCommand } from '../sandbox/e2b'
import {
  finalizeCommandArtifacts,
  initCommandArtifacts,
} from '../sandbox/command-store'
import { newCommandId } from '../sandbox/ids'

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
}

const TRIGGER_LOG_PREFIX = '[trigger]'

export const runCommand = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: z
        .string()
        .describe('The ID of the E2B sandbox to run the command in'),
      command: z
        .string()
        .describe(
          "The base command to run (e.g., 'npm', 'node', 'python', 'ls', 'cat'). Do NOT include arguments here. IMPORTANT: Each command runs independently in a fresh shell session - there is no persistent state between commands. You cannot use 'cd' to change directories for subsequent commands."
        ),
      args: z
        .array(z.string())
        .optional()
        .describe(
          "Array of arguments for the command. Each argument should be a separate string (e.g., ['install', '--verbose'] for npm install --verbose, or ['src/index.js'] to run a file, or ['-la', './src'] to list files). IMPORTANT: Use relative paths (e.g., 'src/file.js') or absolute paths instead of trying to change directories with 'cd' first, since each command runs in a fresh shell session."
        ),
      sudo: z
        .boolean()
        .optional()
        .describe('Whether to run the command with sudo'),
      wait: z
        .boolean()
        .describe(
          'Whether to wait for the command to finish before returning. If true, the command will block until it completes, and you will receive its output.'
        ),
    }),
    execute: async (
      { sandboxId, command, sudo, wait, args = [] },
      { toolCallId }
    ) => {
      const cmdId = newCommandId()

      writer.write({
        id: toolCallId,
        type: 'data-run-command',
        data: { sandboxId, command, args, status: 'executing' },
      })

      try {
        await connectE2BSandbox(sandboxId)
      } catch (error) {
        const richError = getRichError({
          action: 'connect to sandbox',
          args: { sandboxId },
          error,
        })

        writer.write({
          id: toolCallId,
          type: 'data-run-command',
          data: {
            sandboxId,
            command,
            args,
            error: richError.error,
            status: 'error',
          },
        })

        return richError.message
      }

      writer.write({
        id: toolCallId,
        type: 'data-run-command',
        data: {
          sandboxId,
          commandId: cmdId,
          command,
          args,
          status: 'executing',
        },
      })

      if (!wait) {
        try {
          console.log(`${TRIGGER_LOG_PREFIX} queueing background command`, {
            sandboxId,
            cmdId,
            command,
          })
          const handle = await tasks.trigger('e2b-run-command', {
            sandboxId,
            cmdId,
            command,
            args,
            sudo,
          })
          console.log(`${TRIGGER_LOG_PREFIX} background command queued`, {
            sandboxId,
            cmdId,
            triggerRunId: handle.id,
          })

          await initCommandArtifacts({
            sandboxId,
            cmdId,
            triggerRunId: handle.id,
          })

          writer.write({
            id: toolCallId,
            type: 'data-run-command',
            data: {
              sandboxId,
              commandId: cmdId,
              command,
              args,
              status: 'running',
            },
          })

          return `The command \`${command} ${args.join(
            ' '
          )}\` has been queued to run in the background in sandbox \`${sandboxId}\` with commandId \`${cmdId}\`.`
        } catch (error) {
          const richError = getRichError({
            action: 'trigger background command',
            args: { sandboxId, cmdId },
            error,
          })

          writer.write({
            id: toolCallId,
            type: 'data-run-command',
            data: {
              sandboxId,
              commandId: cmdId,
              command,
              args,
              error: richError.error,
              status: 'error',
            },
          })

          return richError.message
        }
      }

      writer.write({
        id: toolCallId,
        type: 'data-run-command',
        data: {
          sandboxId,
          commandId: cmdId,
          command,
          args,
          status: 'waiting',
        },
      })

      try {
        await initCommandArtifacts({ sandboxId, cmdId })
        const sandbox = await connectE2BSandbox(sandboxId)
        const cmd = sudo ? 'sudo' : command
        const cmdArgs = sudo ? [command, ...args] : args

        const { stdout, stderr, exitCode } = await e2bRunCommand({
          sandbox,
          command: cmd,
          args: cmdArgs,
        })

        await finalizeCommandArtifacts({
          sandboxId,
          cmdId,
          exitCode,
          stdout,
          stderr,
        })

        writer.write({
          id: toolCallId,
          type: 'data-run-command',
          data: {
            sandboxId,
            commandId: cmdId,
            command,
            args,
            exitCode,
            status: 'done',
          },
        })

        return (
          `The command \`${command} ${args.join(
            ' '
          )}\` has finished with exit code ${exitCode}.` +
          `Stdout of the command was: \n` +
          `\`\`\`\n${stdout}\n\`\`\`\n` +
          `Stderr of the command was: \n` +
          `\`\`\`\n${stderr}\n\`\`\``
        )
      } catch (error) {
        const richError = getRichError({
          action: 'wait for command to finish',
          args: { sandboxId, commandId: cmdId },
          error,
        })

        writer.write({
          id: toolCallId,
          type: 'data-run-command',
          data: {
            sandboxId,
            commandId: cmdId,
            command,
            args,
            error: richError.error,
            status: 'error',
          },
        })

        return richError.message
      }
    },
  })
