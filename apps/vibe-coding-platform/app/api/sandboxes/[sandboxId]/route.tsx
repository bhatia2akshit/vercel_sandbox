import { NextRequest, NextResponse } from 'next/server'
import { connectE2BSandbox, e2bRunCommand } from '@/ai/sandbox/e2b'
import { NotFoundError } from 'e2b'

/**
 * We must change the SDK to add data to the instance and then
 * use it to retrieve the status of the E2B sandbox.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sandboxId: string }> }
) {
  const { sandboxId } = await params
  try {
    const sandbox = await connectE2BSandbox(sandboxId)
    await e2bRunCommand({
      sandbox,
      command: 'echo',
      args: ['E2B sandbox status check'],
    })
    return NextResponse.json({ status: 'running' })
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ status: 'stopped' })
    }

    throw error
  }
}
