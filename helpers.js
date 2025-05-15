import { setTimeout as waitForTimeout } from 'timers/promises'

export async function retryWithBackoff(func, retry = (retryLimit = 3)) {
  try {
    return func()
  } catch (err) {
    console.error(
      `Transcription failed (try ${retryLimit - retry + 1}):`,
      err.message
    )
    if (!retry) throw err
    await waitForTimeout(1000 * (retryLimit - retry + 1))
    retryWithBackoff(func, filePath, retry - 1)
  }
}
