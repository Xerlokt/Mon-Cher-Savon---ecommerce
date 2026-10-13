import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfirmPaymentUseCase } from '../../application/confirm-payment.use-case.js';
import { DomainError } from '../../domain/shared/domain-error.js';
import { verifyMercadoPagoSignature } from '../../infrastructure/mercadopago/mercadopago.signature.js';

export const MP_WEBHOOK_SECRET = 'MP_WEBHOOK_SECRET';

@ApiExcludeController()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    @Inject(ConfirmPaymentUseCase) private readonly confirmPayment: ConfirmPaymentUseCase,
    @Inject(MP_WEBHOOK_SECRET) private readonly secret: string,
  ) {}

  @Post('mercadopago')
  @HttpCode(200)
  async mercadoPago(
    @Headers('x-signature') signature: string | undefined,
    @Headers('x-request-id') requestId: string | undefined,
    @Query('data.id') queryDataId: string | undefined,
    @Body() body: { type?: string; data?: { id?: string | number } } | undefined,
  ): Promise<{ received: true }> {
    const dataId = queryDataId ?? (body?.data?.id !== undefined ? String(body.data.id) : undefined);
    const valid = verifyMercadoPagoSignature({
      secret: this.secret,
      xSignature: signature,
      xRequestId: requestId,
      dataId,
    });
    if (!valid) throw new UnauthorizedException('Assinatura inválida');

    if (body?.type !== 'payment' || !dataId) return { received: true };

    try {
      await this.confirmPayment.execute(dataId);
    } catch (error) {
      // Permanent business failures (e.g. no stock left) must not make the provider retry forever.
      if (error instanceof DomainError) {
        this.logger.error(`Pagamento ${dataId} aprovado mas não aplicado: ${error.message}`);
        return { received: true };
      }
      throw error;
    }
    return { received: true };
  }
}
