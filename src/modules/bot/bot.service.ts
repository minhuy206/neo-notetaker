import {
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { exec } from 'child_process'
import * as chokidar from 'chokidar'
import * as fs from 'fs'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { getStream, launch } from 'puppeteer-stream'
import { StorageService } from '../storage/storage.service'
import { TranscriptionService } from '../transcription/transcription.service'
import { CreateBotDto } from './dtos/create-bot.dto'

@Injectable()
export class BotService {
  private readonly logger = new Logger(BotService.name)
  private readonly maxDuration: number
  private readonly maxSessions: number
  private readonly folderPath: string
  private readonly filePathPattern = /chunk_(\d+)\.webm/
  private watcher: chokidar.FSWatcher

  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService
  ) {
    this.folderPath = this.configService.get<string>('BOT_FOLDER_PATH')
    this.maxDuration = this.configService.get<number>('MAX_DURATION')
    this.maxSessions = this.configService.get<number>('MAX_SESSIONS')

    // * Initialize folder path
    if (!fs.existsSync(this.folderPath)) {
      this.logger.log(
        `Folder path does not exist, creating folder ${this.folderPath}`
      )
      fs.mkdirSync(this.folderPath)
      this.logger.log(`Folder created!`)
    } else {
      this.logger.log(
        `Folder path exists, deleting files in folder ${this.folderPath}`
      )
      const files = fs.readdirSync(this.folderPath)
      files.forEach((file) => {
        if (file.startsWith('chunk_') && file.endsWith('.webm')) {
          fs.unlinkSync(`${this.folderPath}/${file}`)
        }
      })
      this.logger.log(`Files deleted!`)
    }

    // * Initialize watcher
    this.logger.log(`Bot is watching at folder path: ${this.folderPath}`)
    this.watcher = chokidar.watch(this.folderPath, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 1000 * this.maxDuration,
        pollInterval: 100
      }
    })
    this.logger.log('Watcher initialized')

    this.logger.log('BotService initialized')
  }

  private async startWatcher(meetingId: string) {
    this.logger.log('Starting watcher...')

    this.watcher.on('add', async (filePath) => {
      this.logger.log(`New file detected: ${filePath}`)
      try {
        if (!this.filePathPattern.test(filePath)) {
          return
        }
        console.log(`File ${filePath} has been added`)

        const transcript = await this.transcriptionService.transcribe(filePath)
        await Promise.all([
          this.storageService.saveAudio(
            filePath,
            `${meetingId}/audio/${filePath.split('/').pop()}`
          ),
          this.storageService.saveTranscript(
            transcript,
            `${meetingId}/transcript/${filePath
              .replace('.webm', '.txt')
              .split('/')
              .pop()
              .replace('chunk', 'transcription')}`
          )
        ])
        this.logger.log(`Transcript saved to storage!`)

        fs.unlink(filePath, (err) => {
          if (err) {
            throw new InternalServerErrorException(
              `Error deleting file ${filePath}: ${err}`
            )
          } else {
            this.logger.log(`File ${filePath} deleted successfully.`)
          }
        })
      } catch (error) {
        this.logger.error(`Error in startWatcher function: ${error}`)
        throw new InternalServerErrorException(
          `Error in startWatcher function: ${error}`
        )
      }
    })
  }

  async startBot() {
    const stealthPlugin = StealthPlugin()
    stealthPlugin.enabledEvasions.delete('iframe.contentWindow')
    stealthPlugin.enabledEvasions.delete('media.codecs')
    puppeteer.use(stealthPlugin)
    const config: any = {
      headless: 'new',
      executablePath: this.configService.get<string>(
        'PUPPETEER_EXECUTABLE_PATH'
      ),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreHTTPSErrors: true
    }
    const browser = await launch(puppeteer, config)
    this.logger.log('Bot started')
    return browser
  }

  private async joinGoogleMeet(page: any, meetingUrl: string) {
    try {
      await page.setDefaultNavigationTimeout(30000)
      await page.setDefaultTimeout(30000)

      await page.goto(meetingUrl, {
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 30000
      })
      this.logger.log('Navigated to meeting URL')

      await new Promise((resolve) => setTimeout(resolve, 5000))
      await page.waitForSelector('input[type="text"]', { timeout: 30000 })
      this.logger.log('Found input field')

      await page.type('input[type="text"]', 'Neo NoteTaker')
      this.logger.log('Typed in input field')

      await new Promise((resolve) => setTimeout(resolve, 5000))
      const joinButton = await page.waitForSelector(
        `button[class="UywwFc-LgbsSe UywwFc-LgbsSe-OWXEXe-SfQLQb-suEOdc UywwFc-LgbsSe-OWXEXe-dgl2Hf UywwFc-StrnGf-YYd4I-VtOx3e tusd3  IyLmn QJgqC"]`,
        { timeout: 30000 }
      )
      this.logger.log('Found join button')

      await joinButton.click()
      this.logger.log('Clicked join button')
    } catch (error) {
      this.logger.error(`Error in joinGoogleMeet function: ${error}`)
      throw new InternalServerErrorException(
        `Error in joinGoogleMeet function: ${error}`
      )
    }
  }

  async record(createBotDto: CreateBotDto) {
    try {
      const { meetingUrl } = createBotDto
      const meetingId = meetingUrl.split('/').pop()
      const browser = await this.startBot()
      const page = await browser.newPage()

      await this.joinGoogleMeet(page, meetingUrl)
      const stream = await getStream(page, {
        audio: true,
        video: false,
        mimeType: 'audio/webm'
      })
      this.logger.log('Puppeteer stream created')

      const ffmpeg = exec(`
        ffmpeg -y -i - -c copy -map 0 -f segment -segment_time ${this.maxDuration} -reset_timestamps 1 ${this.folderPath}/chunk_%d.webm
      `)
      this.logger.log('Ffmpeg process created')

      stream.on('close', () => {
        ffmpeg.stdin.end()
      })

      stream.pipe(ffmpeg.stdin)
      this.logger.log('Stream piped to ffmpeg')

      this.startWatcher(meetingId)
      this.logger.log('Watcher started')

      setTimeout(
        async () => {
          try {
            stream.destroy()
            ffmpeg.stdin.end()
            await browser.close()
            this.logger.log('Browser closed')
          } catch (error) {
            this.logger.error(`Error in record function: ${error}`)
            throw new InternalServerErrorException(
              `Error in record function: ${error}`
            )
          }
        },
        1000 * this.maxDuration * this.maxSessions
      )
      this.logger.log('Record function completed')
    } catch (error) {
      this.logger.error(`Error in record function: ${error}`)
      throw new InternalServerErrorException(
        `Error in record function: ${error}`
      )
    }
  }
}
