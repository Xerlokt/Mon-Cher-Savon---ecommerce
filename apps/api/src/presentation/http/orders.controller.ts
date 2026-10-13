import { Body, Controller, Get, HttpCode, Inject, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { createOrderSchema, type CreateOrderResponse } from '@mon-cher-savon/contracts';
import { CreateOrderUseCase } from '../../application/create-order.use-case.js';
import { GetOrderStatusUseCase } from '../../application/get-order-status.use-case.js';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(
    @Inject(CreateOrderUseCase) private readonly createOrder: CreateOrderUseCase,
    @Inject(GetOrderStatusUseCase) private readonly getStatus: GetOrderStatusUseCase,
  ) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Cria pedido e devolve os dados do pagamento (preço sempre do banco)' })
  async create(@Body() body: unknown): Promise<CreateOrderResponse> {
    const input = createOrderSchema.parse(body);
    const result = await this.createOrder.execute({
      items: input.items,
      customer: input.customer,
      address: {
        cep: input.address.cep,
        street: input.address.street,
        number: input.address.number,
        district: input.address.district,
        city: input.address.city,
        state: input.address.state,
        ...(input.address.complement ? { complement: input.address.complement } : {}),
      },
      shippingOption: input.shippingOption,
      paymentMethod: input.paymentMethod,
      ...(input.cardToken ? { cardToken: input.cardToken } : {}),
      ...(input.cardPaymentMethodId ? { cardPaymentMethodId: input.cardPaymentMethodId } : {}),
    });
    return {
      publicCode: result.publicCode,
      totalCents: result.totalCents,
      payment: {
        ...(result.payment.pixCopyPaste ? { pixCopyPaste: result.payment.pixCopyPaste } : {}),
        ...(result.payment.pixQrCodeBase64
          ? { pixQrCodeBase64: result.payment.pixQrCodeBase64 }
          : {}),
      },
    };
  }

  @Get(':publicCode')
  @ApiOperation({ summary: 'Status do pedido pelo código público' })
  status(@Param('publicCode') publicCode: string) {
    return this.getStatus.execute(publicCode.toUpperCase());
  }
}
