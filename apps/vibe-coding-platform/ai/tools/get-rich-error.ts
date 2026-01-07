interface Params {
  args?: Record<string, unknown>
  action: string
  error: unknown
}

/**
 * Allows to parse a thrown error to check its metadata and construct a rich
 * message that can be handed to the LLM.
 */
export function getRichError({ action, args, error }: Params) {
  const fields = getErrorFields(error)
  let message = `Error during ${action}: ${fields.message}`
  if (args) message += `\nParameters: ${JSON.stringify(args, null, 2)}`
  if (fields.json) message += `\nJSON: ${JSON.stringify(fields.json, null, 2)}`
  if (fields.text) message += `\nText: ${fields.text}`
  return {
    message: message,
    error: fields,
  }
}

function getErrorFields(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      message: String(error),
      json: error,
    }
  } else {
    const anyError = error as any
    const json =
      anyError?.json ??
      anyError?.response?.data ??
      anyError?.body ??
      anyError?.cause ??
      undefined
    const text =
      typeof anyError?.text === 'string'
        ? anyError.text
        : typeof anyError?.response?.text === 'string'
        ? anyError.response.text
        : undefined
    return {
      message: error.message,
      json,
      text,
    }
  }
}
