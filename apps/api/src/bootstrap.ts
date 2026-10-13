import { resolve } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import type { AppConfig } from './config.js';

/** Everything that is configured on the HTTP server itself (headers, CORS, static files, docs). */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  if (config.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // The API only returns JSON and images, so the default strict CSP is fine. Swagger UI needs inline
  // scripts and styles, so only /api/docs gets a relaxed policy.
  const strict = helmet();
  const docs = helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/api/docs') ? docs(req, res, next) : strict(req, res, next),
  );

  app.useStaticAssets(resolve(config.UPLOAD_DIR), {
    prefix: '/uploads',
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  app.setGlobalPrefix('api/v1');
  // CORS is restricted to the store's own origin; the browser normally uses the same-origin proxy.
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: true });

  if (config.ENABLE_DOCS) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Mon Cher Savon API').setVersion('1').build(),
    );
    SwaggerModule.setup('api/docs', app, doc);
  }
}
