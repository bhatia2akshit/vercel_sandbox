import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { getRichError } from './get-rich-error'
import { tool } from 'ai'
import description from './get-sandbox-url.md'
import z from 'zod/v3'
import { connectE2BSandbox, e2bWaitForPort } from '../sandbox/e2b'

interface Params {
  writer: UIMessageStreamWriter<UIMessage<never, DataPart>>
}

export const getSandboxURL = ({ writer }: Params) =>
  tool({
    description,
    inputSchema: z.object({
      sandboxId: z
        .string()
        .describe(
          'The unique identifier of the E2B sandbox. This ID is returned when creating a sandbox and is used to reference the specific sandbox instance.'
        ),
      port: z
        .number()
        .describe(
          'The port number where a service is running inside the sandbox (e.g., 3000 for Next.js dev server, 8000 for Python apps, 5000 for Flask).'
        ),
      waitForPort: z
        .boolean()
        .optional()
        .describe(
          'Whether to wait for the port to be listening before returning the URL. Defaults to true.'
        ),
      timeoutMs: z
        .number()
        .min(1000)
        .max(120000)
        .optional()
        .describe(
          'How long to wait for the port to open when waitForPort is enabled. Defaults to 30000ms.'
        ),
    }),
    execute: async (
      { sandboxId, port, waitForPort, timeoutMs },
      { toolCallId }
    ) => {
      writer.write({
        id: toolCallId,
        type: 'data-get-sandbox-url',
        data: { status: 'loading' },
      })

      try {
        const sandbox = await connectE2BSandbox(sandboxId)
        const shouldWait = waitForPort ?? true
        if (shouldWait) {
          const ready = await e2bWaitForPort({
            sandbox,
            port,
            timeoutMs: timeoutMs ?? 30_000,
          })
          if (!ready) {
            throw new Error(
              `No service is listening on port ${port} in sandbox ${sandboxId} after ${
                timeoutMs ?? 30_000
              }ms`
            )
          }
        }

        const url = sandbox.getHost(port)

        writer.write({
          id: toolCallId,
          type: 'data-get-sandbox-url',
          data: { url, status: 'done' },
        })

        return { url }
      } catch (error) {
        const richError = getRichError({
          action: 'Get E2B Sandbox URL',
          args: { sandboxId, port },
          error,
        })

        writer.write({
          id: toolCallId,
          type: 'data-get-sandbox-url',
          data: {
            status: 'error',
            error: { message: richError.error.message },
          },
        })

        return richError.message
      }
    },
  })
