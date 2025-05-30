import { ConfigModule } from '@nestjs/config'
import * as Joi from 'joi'
import { ApplicationConfiguration } from 'src/configs/domains/application.domain'
import { AuthConfiguration } from 'src/configs/domains/auth.domain'
import { DomainEnum } from 'src/configs/enums/domain.enum'
import { IAppConfig } from 'src/configs/interfaces/application-config.interface'

const validationSchema: Joi.ObjectSchema<IAppConfig> = Joi.object({
  // App domain validation
  NAME: Joi.string().default('Application'),
  HOST: Joi.string().default('localhost'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),

  // Authentication domain validation
  JWT_SECRET: Joi.string().required(),
  ACCESS_TOKEN_EXPIRES_IN: Joi.string().default('1h'),
  REFRESH_TOKEN_EXPIRES_IN: Joi.string().default('1d'),

  // Google Cloud Storage validation
  GCS_BUCKET_NAME: Joi.string().default('neo_notetaker_storage'),
  GCS_PROJECT_ID: Joi.string().default('667139638067'),
  GCS_KEY_FILE: Joi.string().default('key.json'),

  // Bot validation
  BOT_FOLDER_PATH: Joi.string().default('audio_data'),

  // CHROMIUM_PATH is used to specify the path to the Chromium executable.
  PUPPETEER_EXECUTABLE_PATH: Joi.string().default('/usr/bin/chromium'),

  // Record config
  MAX_DURATION: Joi.number().default(30),
  MAX_SESSIONS: Joi.number().default(4)
})

const DomainRegistraions: any[] = [ApplicationConfiguration, AuthConfiguration]

const AppConfigModule = ConfigModule.forRoot({
  isGlobal: true,
  envFilePath: ['.env'],
  load: DomainRegistraions,
  validationSchema
})

export { AppConfigModule, DomainEnum }
