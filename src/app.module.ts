import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from 'src/configs';
import { BotModule } from './modules/bot/bot.module';
import { SampleModule } from './modules/sample/sample.module';
import { StorageModule } from './modules/storage/storage.module';
import { TranscriptionModule } from './modules/transcription/transcription.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    AppConfigModule,
    BotModule,
    SampleModule,
    TranscriptionModule,
    StorageModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
