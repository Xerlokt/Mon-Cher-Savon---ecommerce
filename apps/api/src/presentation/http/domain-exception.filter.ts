import { type ArgumentsHost, Catch, type ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';
import { ProductNotFoundError } from '../../application/browse-catalog.use-case.js';
import { OrderNotFoundError } from '../../application/get-order-status.use-case.js';
import { DomainError } from '../../domain/shared/domain-error.js';
import { PaymentGatewayError } from '../../infrastructure/mercadopago/mercadopago.gateway.js';

@Catch(DomainError, ZodError, PaymentGatewayError)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(error: DomainError | ZodError | PaymentGatewayError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        statusCode: 400,
        message: 'Dados inválidos',
        issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    if (error instanceof PaymentGatewayError) {
      res.status(HttpStatus.BAD_GATEWAY).json({
        statusCode: 502,
        message: 'Não foi possível processar o pagamento agora. Tente novamente.',
      });
      return;
    }
    const status =
      error instanceof ProductNotFoundError || error instanceof OrderNotFoundError
        ? HttpStatus.NOT_FOUND
        : HttpStatus.UNPROCESSABLE_ENTITY;
    res.status(status).json({ statusCode: status, message: error.message });
  }
}
