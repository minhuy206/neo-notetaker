import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { TranscriptionModule } from '../transcription/transcription.module';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';

@Module({
  imports: [TranscriptionModule, StorageModule],
  controllers: [BotController],
  providers: [BotService],
})
export class BotModule {}
