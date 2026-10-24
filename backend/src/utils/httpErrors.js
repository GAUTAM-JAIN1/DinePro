const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Turn any thrown error into an HTTP response.
 *
 * Bug #24: only errors we raised on purpose (HttpError, or anything carrying a
 * 4xx statusCode, plus JSON body-parse failures) reach the client with their
 * message. Everything else is logged in full on the server and answered with a
 * generic message, so Firestore paths, SDK text and config details never leak.
 */
function httpStatusOf(err) {
  const explicit = Number(err?.statusCode)
  if (explicit >= 400 && explicit <= 599) return explicit
  if (typeof err?.type === 'string' && err.type.startsWith('entity.') && Number(err.status) >= 400) {
    return Number(err.status)
  }
  return 500
}

/** Client-safe message for an error: its own text for 4xx, a generic line for everything else. */
function publicMessage(err) {
  if (err?.code === 'auth/email-already-exists') return 'A user with this email already exists'
  return httpStatusOf(err) >= 500 ? GENERIC_MESSAGE : err.message
}

function sendError(res, err, { label = 'request' } = {}) {
  if (err?.code === 'auth/email-already-exists') {
    return res.status(409).json({ success: false, error: 'A user with this email already exists' })
  }
  const status = httpStatusOf(err)
  if (status >= 500) {
    console.error(`${label} failed:`, err)
    return res.status(status).json({ success: false, error: GENERIC_MESSAGE })
  }
  return res.status(status).json({ success: false, error: err.message, ...(err.extra || {}) })
}

module.exports = { sendError, publicMessage, GENERIC_MESSAGE }
