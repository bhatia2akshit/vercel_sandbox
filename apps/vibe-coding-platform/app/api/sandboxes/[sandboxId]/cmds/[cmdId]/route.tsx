import { NextResponse, type NextRequest } from 'next/server'
import { readCommandMeta } from '@/ai/sandbox/command-store'

interface Params {
  sandboxId: string
  cmdId: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<Params> }
) {
  const cmdParams = await params
  const meta = await readCommandMeta(cmdParams)
  return NextResponse.json({
    sandboxId: cmdParams.sandboxId,
    cmdId: cmdParams.cmdId,
    startedAt: meta?.startedAt ?? Date.now(),
    exitCode: meta?.exitCode,
  })
}
