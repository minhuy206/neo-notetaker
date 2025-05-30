import { registerAs } from '@nestjs/config';
import { DomainEnum } from '../enums/domain.enum';
import { IAppConfig } from 'src/configs/interfaces/application-config.interface';

export const BotConfiguration = registerAs(DomainEnum.BOT, (): IAppConfig[DomainEnum.BOT] => ({
  folderPath: process.env.BOT_FOLDER_PATH,
}));