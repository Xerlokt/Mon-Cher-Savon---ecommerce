import { Body, Controller, Get, HttpCode, Inject, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { testNotificationSchema, updateNotificationSettingSchema } from '@mon-cher-savon/contracts';
import {
  GetNotificationSettingsUseCase,
  SendTestNotificationUseCase,
  UpdateNotificationSettingUseCase,
} from '../../application/notification-settings.use-cases.js';
import { AdminGuard } from './admin.guard.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/notifications')
export class NotificationsController {
  constructor(
    @Inject(GetNotificationSettingsUseCase) private readonly get: GetNotificationSettingsUseCase,
    @Inject(UpdateNotificationSettingUseCase)
    private readonly update: UpdateNotificationSettingUseCase,
    @Inject(SendTestNotificationUseCase) private readonly sendTest: SendTestNotificationUseCase,
  ) {}

  @Get('settings')
  @ApiOperation({ summary: 'Canais de aviso, destinos e quais estão disponíveis' })
  settings() {
    return this.get.execute();
  }

  @Put('settings')
  @ApiOperation({ summary: 'Liga ou desliga um canal e define o destino' })
  async save(@Body() body: unknown) {
    const input = updateNotificationSettingSchema.parse(body);
    return this.update.execute(input);
  }

  @Post('test')
  @HttpCode(200)
  @ApiOperation({ summary: 'Envia uma mensagem de teste pelo canal' })
  async test(@Body() body: unknown): Promise<{ sent: true }> {
    const { channel } = testNotificationSchema.parse(body);
    await this.sendTest.execute(channel);
    return { sent: true };
  }
}
