import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { APP_CONFIG, type AppConfig } from '../../config.js';

@ApiTags('shipping')
@Controller('shipping-options')
export class ShippingController {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  @Get()
  @ApiOperation({ summary: 'Opções de entrega e valores fixos do MVP' })
  list() {
    return [
      {
        code: 'PICKUP',
        label: 'Retirada com a artesã',
        priceCents: this.config.SHIPPING_PICKUP_CENTS,
      },
      { code: 'LOCAL', label: 'Entrega local', priceCents: this.config.SHIPPING_LOCAL_CENTS },
      {
        code: 'SHIPPING',
        label: 'Envio pelos Correios',
        priceCents: this.config.SHIPPING_FLAT_CENTS,
      },
    ];
  }
}
