import { SpeechClient, protos } from '@google-cloud/speech'
import {
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs'

@Injectable()
export class TranscriptionService {
  private readonly logger = new Logger(TranscriptionService.name)
  private speechClient: SpeechClient

  constructor(private readonly configService: ConfigService) {
    this.speechClient = new SpeechClient({
      keyFilename: this.configService.get('GCS_KEY_FILE')
    })
  }

  async transcribe(path: string): Promise<string> {
    try {
      this.logger.log(`Transcribing audio file: ${path}`)

      const audioBuffer = fs.readFileSync(path)
      const audio = {
        content: audioBuffer.toString('base64')
      }
      this.logger.log('[DEBUG] Audio Buffer size:', audioBuffer.length)

      this.logger.log(
        '[DEBUG] Audio Preview (base64):',
        audioBuffer.toString('base64').substring(0, 100)
      )

      // Nếu size là 0 → không gửi request nữa
      if (audioBuffer.length === 0) {
        this.logger.error(
          '[ERROR] Audio buffer is empty. Skipping transcription.'
        )
        return
      }

      const config: protos.google.cloud.speech.v1.IRecognitionConfig = {
        encoding:
          protos.google.cloud.speech.v1.RecognitionConfig.AudioEncoding
            .WEBM_OPUS,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        audioChannelCount: 2,
        enableSeparateRecognitionPerChannel: false
      }

      const [response] = await this.speechClient.recognize({
        audio,
        config
      })

      this.logger.log(`Transcription response: ${JSON.stringify(response)}`)

      return response.results
        .map((result) => result.alternatives[0].transcript)
        .join('\n')
    } catch (error) {
      this.logger.error('Error in transcription process:', error)
      throw new InternalServerErrorException('Failed to transcribe audio')
    }
  }
}
