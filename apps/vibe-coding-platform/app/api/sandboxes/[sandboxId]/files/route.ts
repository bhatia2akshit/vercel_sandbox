import { NextResponse, type NextRequest } from 'next/server'
import z from 'zod/v3'
import { connectE2BSandbox, e2bReadFile } from '@/ai/sandbox/e2b'

const FileParamsSchema = z.object({
  sandboxId: z.string(),
  path: z.string(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params
  const fileParams = FileParamsSchema.safeParse({
    path: request.nextUrl.searchParams.get('path'),
    sandboxId,
  })

  if (fileParams.success === false) {
    return NextResponse.json(
      { error: 'Invalid parameters. You must pass a `path` as query' },
      { status: 400 }
    )
  }

  const sandbox = await connectE2BSandbox(fileParams.data.sandboxId)
  const data = await e2bReadFile({ sandbox, path: fileParams.data.path })
  if (!data) {
    return NextResponse.json(
      { error: 'File not found in the E2B sandbox' },
      { status: 404 }
    )
  }

  const body =
    data.buffer instanceof ArrayBuffer
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : Uint8Array.from(data).buffer
  return new NextResponse(body)
}
