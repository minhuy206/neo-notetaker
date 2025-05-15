import { launch, getStream } from 'puppeteer-stream'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { spawn } from 'child_process'
import chokidar from 'chokidar'
import fs from 'fs'
import { setTimeout as waitForTimeout } from 'timers/promises'
import { googleCloudStorageService } from './googleCloudStorage.service.js'
import { speechToTextService } from './speechToText.service.js'
import 'dotenv/config'
import { retryWithBackoff } from './helpers.js'
const email = process.env.GOOGLE_EMAIL || ''
const password = process.env.GOOGLE_PASSWORD || ''
const meeting_id = process.env.GOOGLE_MEET_ID || ''
const maxSessions = 4
const maxDuration = 30
const filePathPattern = /chunk_(\d+)\.webm/
let count = 0

async function transcribe(filePath, transcriptionFilePath) {
  try {
    const text = await retryWithBackoff(
      () => speechToTextService.transcribeAudio(filePath),
      3
    )
    const transcription = text[0].results
      .map((r) => r.alternatives[0].transcript)
      .join('\n')
    fs.appendFileSync(transcriptionFilePath, transcription + '\n\n')
  } catch (error) {
    console.error('Error in transcribe function:', error)
    throw error
  }
}

function store(bucketName, filePath, destination) {
  try {
    return retryWithBackoff(
      () =>
        googleCloudStorageService.uploadFileToGCS(
          bucketName,
          filePath,
          destination
        ),
      3
    )
  } catch (error) {
    console.error('Error in store function:', error)
    throw error
  }
}

async function signinGoogle(page) {
  try {
    await page.goto('https://accounts.google.com/')
    await waitForTimeout(1000)
    await page.waitForSelector('input[type="email"]')
    await page.type('input[type="email"]', email)
    await waitForTimeout(1000)
    await page.keyboard.press('Enter')
    await waitForTimeout(2000)
    await page.waitForSelector('input[type="password"]')
    await page.type('input[type="password"]', password)
    await waitForTimeout(1000)
    await page.keyboard.press('Enter')
  } catch (error) {
    console.error('Error in signinGoogle function:', error)
  }
}

async function joinGoogleMeet(page) {
  try {
    await page.goto(`https://meet.google.com/${meeting_id}`, {
      waitUntil: 'networkidle0',
      timeout: 10000
    })

    await waitForTimeout(1000)
    const skipUsingMicButton = await page.waitForSelector(
      `button[class="mUIrbf-LgbsSe mUIrbf-LgbsSe-OWXEXe-dgl2Hf mUIrbf-StrnGf-YYd4I-VtOx3e"]`
    )
    await skipUsingMicButton.click()

    await waitForTimeout(1000)
    const joinButton = await page.waitForSelector(
      `button[class="UywwFc-LgbsSe UywwFc-LgbsSe-OWXEXe-SfQLQb-suEOdc UywwFc-LgbsSe-OWXEXe-dgl2Hf UywwFc-StrnGf-YYd4I-VtOx3e tusd3  IyLmn QJgqC"]`
    )
    await joinButton.click()
  } catch (error) {
    console.error('Error in joinGoogleMeet function:', error)
  }
}

;(async function main() {
  puppeteer.use(StealthPlugin())

  const browser = await launch(puppeteer, {
    headless: 'new',
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1280, height: 720 }
  })

  const page = await browser.newPage()

  await signinGoogle(page)

  await waitForTimeout(5000)

  await joinGoogleMeet(page)

  const stream = await getStream(page, {
    audio: true,
    video: false,
    mimeType: 'audio/webm'
  })

  // Tạo process ffmpeg để tách mỗi 30s
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

  if (!fs.existsSync('chunks')) {
    fs.mkdirSync('chunks')
  } else {
    const files = fs.readdirSync('chunks')
    files.forEach((file) => {
      if (file.startsWith('chunk_') && file.endsWith('.webm')) {
        fs.unlinkSync(`chunks/${file}`)
      }
    })
  }

  if (!fs.existsSync('transcriptions')) {
    fs.mkdirSync('transcriptions')
  } else {
    const files = fs.readdirSync('transcriptions')
    files.forEach((file) => {
      if (file.startsWith('transcription_') && file.endsWith('.txt')) {
        fs.unlinkSync(`transcriptions/${file}`)
      }
    })
  }
  stream.pipe(ffmpeg.stdin)

  chokidar.watch('./chunks').on('add', async (path) => {
    try {
      if (path !== 'chunks/chunk_0.webm' && count - 1 < maxSessions) {
        let lastSize = 0
        const interval = setInterval(async () => {
          const newSize = fs.statSync(path).size
          if (newSize === lastSize) {
            clearInterval(interval)
            const audioFilePath = path.replace(
              filePathPattern,
              `chunk_${count}.webm`
            )
            const transcribedFilePath = path
              .replace(filePathPattern, `chunk_${count}.webm`)
              .replace('.webm', '.txt')
              .replaceAll('chunk', 'transcription')
            await Promise.all([
              transcribe(audioFilePath, transcribedFilePath),
              store(
                process.env.GOOGLE_CLOUD_BUCKET_NAME,
                audioFilePath,
                `${meeting_id}/audio/${audioFilePath.split('/').pop()}`
              )
            ])
            count++
          } else {
            lastSize = newSize
          }
        }, 500)
      }
    } catch (error) {
      console.error('Error in file watcher:', error)
    }
  })

  chokidar.watch('./transcriptions').on('add', async (path) => {
    try {
      await store(
        process.env.GOOGLE_CLOUD_BUCKET_NAME,
        path,
        `${meeting_id}/transcriptions/${path.split('/').pop()}`
      )
    } catch (error) {
      console.error('Error in transcription file watcher:', error)
    }
  })

  setTimeout(async () => {
    await stream.destroy()
    ffmpeg.stdin.end()
    await browser.close()
    let lastSize = 0
    const interval = setInterval(async () => {
      const newSize = fs.statSync(`chunks/chunk_${maxSessions - 1}.webm`).size
      if (newSize === lastSize) {
        clearInterval(interval)
        await Promise.all([
          transcribe(
            `chunks/chunk_${maxSessions - 1}.webm`,
            `transcriptions/transcription_${maxSessions - 1}.txt`
          ),
          store(
            process.env.GOOGLE_CLOUD_BUCKET_NAME,
            `chunks/chunk_${maxSessions - 1}.webm`,
            `${meeting_id}/audio/chunk_${maxSessions - 1}.webm`
          )
        ])
      } else {
        lastSize = newSize
      }
    }, 500)
    console.log('Done recording and splitting.')
  }, 1000 * maxDuration * maxSessions)
})()
