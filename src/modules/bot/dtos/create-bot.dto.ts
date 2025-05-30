import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { IsGoogleMeetUrl } from 'src/common/validators/google-meet-url.validator';

export class CreateBotDto {
  @ApiProperty({
    description: 'Google meeting URL',
    example: 'https://meet.google.com/abc-defg-hij',
  })
  @IsNotEmpty()
  @IsGoogleMeetUrl()
  meetingUrl: string;
}
