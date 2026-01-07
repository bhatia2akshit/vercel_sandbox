import type { UIMessageStreamWriter, UIMessage } from 'ai'
import type { DataPart } from '../messages/data-parts'
import { tool } from 'ai'
import description from './get-sandbox-url.md'
import z from 'zod/v3'
import { connectE2BSandbox } from '../sandbox/e2b'

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
    }),
    execute: async ({ sandboxId, port }, { toolCallId }) => {
      writer.write({
        id: toolCallId,
        type: 'data-get-sandbox-url',
        data: { status: 'loading' },
      })

      const sandbox = await connectE2BSandbox(sandboxId)
      const url = sandbox.getHost(port)

      writer.write({
        id: toolCallId,
        type: 'data-get-sandbox-url',
        data: { url, status: 'done' },
      })

      return { url }
    },
  })
