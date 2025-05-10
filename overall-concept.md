# 🎯 Idea: Auto Join Google Meet, Record Audio, and Transcribe Every 30 Seconds

## 📝 Objective

Build a Node.js application that:

1. Automatically signs into a Google account.
2. Joins a Google Meet call.
3. Records the meeting's audio in real-time using `puppeteer-stream`.
4. Uses `ffmpeg` to **chunk the recorded audio every 30 seconds** into `.webm` files.
5. Automatically **transcribes each audio chunk** using Google Cloud Speech-to-Text API.
6. Stops recording after a defined session duration (e.g., 2 minutes / 4 segments).

---

## 🛠️ Tools & Libraries

- [`puppeteer-extra`](https://www.npmjs.com/package/puppeteer-extra): Headless Chrome automation.
- [`puppeteer-stream`](https://www.npmjs.com/package/puppeteer-stream): Captures browser media streams (audio/video).
- [`ffmpeg`](https://ffmpeg.org/): Used to split the live audio stream into 30-second `.webm` files.
- [`chokidar`](https://www.npmjs.com/package/chokidar): Watches for newly created chunk files.
- [`@google-cloud/speech`](https://cloud.google.com/speech-to-text): Converts audio chunks into text.
- `fs`, `timers/promises`: File and delay handling.

---

## 🔁 Workflow

1.  **Login and Join Meet**

    - Open Google login page, fill in credentials.
    - Join a specific Google Meet room URL.

2.  **Record Audio**

    - Use `puppeteer-stream` to get the audio stream.

    ```js
    const stream = await getStream(page, {
      audio: true,
      video: false,
      mimeType: 'audio/webm'
    })
    ```

    - Chunk the stream by `ffmpeg`, which segments it into files like `chunk_0.webm`, `chunk_1.webm`, ...

    ```js
    const ffmpeg = spawn('ffmpeg', [
      '-f',
      'webm',
      '-i',
      'pipe:0',
      '-c',
      'copy',
      '-map',
      '0',
      '-f',
      'segment',
      '-segment_time',
      maxDuration,
      '-reset_timestamps',
      '1',
      'chunks/chunk_%d.webm'
    ])
    ```

3.  **Chunk Detection & Transcription**

    - `chokidar` watches the `chunks/` folder.
    - Every time a new `chunk_*.webm` is created:
      - Run `transcribeAudio()` on the file.
      - Save output to `transcriptions/transcription_*.txt`.

    ```js
    chokidar.watch('./chunks').on('add', async (path) => {
      try {
        if (path !== 'chunks/chunk_0.webm' && count - 1 < maxSessions) {
          await transcribe(
            path.replace(filePathPattern, `chunk_${count}.webm`),
            path
              .replace(filePathPattern, `chunk_${count}.webm`)
              .replace('.webm', '.txt')
              .replaceAll('chunk', 'transcription')
          )
          count++
        }
      } catch (error) {
        console.error('Error in file watcher:', error)
      }
    })
    ```

4.  **Session Control**
    - Limit to `maxSessions` (e.g., 4 chunks → 2 minutes).
    - Automatically stop after the last chunk.
    ```js
    setTimeout(async () => {
      await stream.destroy()
      ffmpeg.stdin.end()
      await browser.close()
      console.log('Done recording and splitting.')
      await transcribe(
        'chunks/chunk_3.webm',
        'transcriptions/transcription_3.txt'
      )
    }, 1000 * maxDuration * maxSessions)
    ```
