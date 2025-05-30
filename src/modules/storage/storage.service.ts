import { Storage, UploadResponse } from '@google-cloud/storage';
import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private storage: Storage;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.storage = new Storage({
      keyFilename: this.configService.get('GCS_KEY_FILE'),
      projectId: this.configService.get('GCS_PROJECT_ID'),
    });
    this.bucketName = this.configService.get<string>('GCS_BUCKET_NAME');
  }

  saveTranscript(
    content: string | Buffer,
    destination: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    try {
      this.logger.log(`Saving file to storage: ${destination}`);
      return this.storage
        .bucket(this.bucketName)
        .file(destination)
        .save(content, {
          contentType: 'text/plain',
          metadata: metadata || {},
        });
    } catch (error) {
      this.logger.error('Error saving file:', error);
      throw new InternalServerErrorException('Failed to save file to storage');
    }
  }

  async saveAudio(
    fileName: string,
    destination: string,
  ): Promise<UploadResponse> {
    try {
      this.logger.log(`Saving audio file to storage: ${destination}`);
      return this.storage.bucket(this.bucketName).upload(fileName, {
        destination,
      });
    } catch (error) {
      this.logger.error('Error saving file:', error);
      throw new InternalServerErrorException('Failed to save file to storage');
    }
  }
}
