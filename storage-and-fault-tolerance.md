# 🎯 Audio & Transcript File Storage with Google Cloud Storage (GCS)

## 🚀 Goal

Store `.webm` audio files and `.txt` transcript files generated from browser audio recording and Google Speech-to-Text transcription in a scalable and fault-tolerant way using **Google Cloud Storage (GCS)**.

---

## 🧩 Proposed Architecture

```css
Puppeteer Stream → Audio (webm)
                      ↓
                  FFmpeg (chunk)
                      ↓
                  ┌──────────────┐
                  │ chunk_X.webm │──────┐
                  └──────────────┘      │
                                        ▼
               Google STT API → transcription_X.txt
                                        ▼
                                  Upload to GCS

```

---

## 🛠 Integrating GCS with Node.js

### 1. Install the GCS client library

```bash
npm install @google-cloud/storage
```

---

### 2. Initialize GCS client gcs.service.js

```js
import { Storage } from '@google-cloud/storage'

const storage = new Storage({
  keyFilename: 'path/to/service-account.json',
  projectId: 'gcp-project-id'
})

const bucketName = 'bucket-name'

export const uploadToGCS = async (localPath, remotePath) => {
  await storage.bucket(bucketName).upload(localPath, {
    destination: remotePath,
    gzip: true
  })
}
```

---

### 3. Upload after processing files

Inside your chokidar watcher, after generating audio and transcript:

```js
await uploadToGCS(audioPath, `audios/${fileName}`)
await uploadToGCS(transcriptPath, `transcripts/${txtFileName}`)
```

---

### 📦 Expected GCS Folder Structure

```arduino
gs://bucket-name/
├── audios/
│   ├── chunk_0.webm
│   └── chunk_1.webm
└── transcripts/
    ├── transcription_0.txt
    └── transcription_1.txt
```

---

# ⚠️ Fault Tolerance & Edge Cases

### 1. Google Speech-to-Text API Fails

**Cause:** Network error, API limit exceeded, invalid audio

**Handling:**

- Retry mechanism (e.g. up to 3 times with exponential backoff)
- On persistent failure:
  - Log the error in `logs/error_<index>.log`
  - Move audio to `backups/failed_<index>.webm` for reprocessing
  - Notify via console or alert system

**Retry with backoff function:**

```js
const retryLimit = 3
async function retryWithBackoff(func, filePath, retry = retryLimit) {
  try {
    return await transcribeAudio(filePath)
  } catch (err) {
    console.error(
      `Transcription failed (try ${retryLimit - retry + 1}):`,
      err.message
    )
    if (!retry) throw err
    await new Promise((res) => setTimeout(res, 1000 * (retryLimit - retry + 1))) // exponential backoff
    await retryWithBackoff(func, filePath, retry - 1)
  }
}
```

**Log errors to a file for later processing:**

```js
fs.appendFileSync(
  'transcription_errors.log',
  `${filePath} failed: ${err.message}\n`
)
```

---

### 📤 2. Recording finished but transcription not completed

**✅ Handling:**

- Record the status processing (which file was recorded successfully):

```json
{
  "chunk_1.webm": "done",
  "chunk_2.webm": "pending"
}
```

---

### 3. File Write Errors

**Cause:** Disk full, permission denied, path not found

**Handling:**

- Wrap `fs.appendFileSync` in try/catch
- Fallback: Write to a fallback directory or temp file
- Log error with timestamp and filename

---

### 4. Chokidar Race Conditions

**Cause:** File not ready when `add` event is fired

**Handling:**

- Wait 1–2 seconds before processing the file
- Check file size has stabilized before sending to API

```js
let lastSize = 0
const interval = setInterval(() => {
  const newSize = fs.statSync(filePath).size
  if (newSize === lastSize) {
    clearInterval(interval)
    processFile(filePath)
  } else {
    lastSize = newSize
  }
}, 500)
```
