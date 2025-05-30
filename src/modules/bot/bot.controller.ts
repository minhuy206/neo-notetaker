import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as fs from 'fs';
import * as path from 'path';
import { SwaggerApiErrorResponse } from 'src/common/decorators/swagger/swagger-api-error-response.decorator';
import { SwaggerApiSuccessResponse } from 'src/common/decorators/swagger/swagger-api-success-response.decorator';
import { BotService } from 'src/modules/bot/bot.service';
import { CreateBotDto } from 'src/modules/bot/dtos/create-bot.dto';

@ApiTags('Bots')
@Controller('bots')
export class BotController {
  constructor(private readonly botService: BotService) {}

  @SwaggerApiSuccessResponse({
    description: 'Bot created',
    sampleMessage: 'Create bot request accepted',
  })
  @SwaggerApiErrorResponse({
    statusCode: 400,
    description: 'Invalid create bot request',
  })
  @HttpCode(200)
  @Post()
  async create(@Body() createBotDto: CreateBotDto) {
    return await this.botService.record(createBotDto);
  }

  @Post('save-chunk')
  async saveChunk(@Body() body: { audio: string; fileName: string }) {
    const chunksDir = 'chunks';
    if (!fs.existsSync(chunksDir)) {
      fs.mkdirSync(chunksDir, { recursive: true });
    }

    const filePath = path.join(chunksDir, body.fileName);
    const audioBuffer = Buffer.from(body.audio, 'base64');

    fs.writeFileSync(filePath, audioBuffer);
    return { success: true, filePath };
  }
}
