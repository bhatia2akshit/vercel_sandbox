import { NextResponse, type NextRequest } from 'next/server'
import {
  readCommandLogsNdjson,
  readCommandMeta,
} from '@/ai/sandbox/command-store'

interface Params {
  sandboxId: string
  cmdId: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const logParams = await params
  const encoder = new TextEncoder()

  return new NextResponse(
    new ReadableStream({
      async pull(controller) {
        let cursor = 0
        while (true) {
          const meta = await readCommandMeta(logParams)
          const logs = await readCommandLogsNdjson(logParams)

          if (logs && logs.length > cursor) {
            controller.enqueue(encoder.encode(logs.slice(cursor)))
            cursor = logs.length
          }

          if (typeof meta?.exitCode === 'number') {
            break
          }

          await new Promise((r) => setTimeout(r, 500))
        }
        controller.close()
      },
    }),
    { headers: { 'Content-Type': 'application/x-ndjson' } }
  )
}
