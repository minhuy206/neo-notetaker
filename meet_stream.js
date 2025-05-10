import { launch, getStream } from 'puppeteer-stream'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { spawn } from 'child_process'
import chokidar from 'chokidar'
import fs from 'fs'
import transcribeAudio from './speechToText.service.js'
import { setTimeout as waitForTimeout } from 'timers/promises'

const email = 'vominhuy206@gmail.com'
const password = 'Vominhuy/2062004.'
const maxSessions = 4
const maxDuration = 30
const filePathPattern = /chunk_(\d+)\.webm/
let count = 0

const transcribe = async (filePath, transcriptionFilePath) => {
  const text = await transcribeAudio(filePath)
  const transcription = text[0].results
    .map((r) => r.alternatives[0].transcript)
    .join('\n')
  fs.appendFileSync(transcriptionFilePath, transcription + '\n\n')
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
    await page.goto('https://meet.google.com/ueo-pmob-nxy', {
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

  if (!fs.existsSync('chunks')) fs.mkdirSync('chunks')
  if (!fs.existsSync('transcriptions')) fs.mkdirSync('transcriptions')
  stream.pipe(ffmpeg.stdin)

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
})()
