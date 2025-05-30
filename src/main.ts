import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { DomainEnum } from 'src/configs';
import { IAppConfig } from 'src/configs/interfaces/application-config.interface';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestLoggerInterceptor } from './common/interceptors/request-logger.interceptor';
import { GlobalValidationPipe } from './common/pipes/global-validation.pipe';
declare const module: any;

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const appConfig: IAppConfig[DomainEnum.APP] = app
    .get(ConfigService)
    .get<IAppConfig[DomainEnum.APP]>(DomainEnum.APP);

  app.enableCors();

  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.useGlobalInterceptors(new RequestLoggerInterceptor());

  app.setGlobalPrefix(appConfig.apiPrefix);
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(new GlobalValidationPipe());

  app.useGlobalFilters(new HttpExceptionFilter());

  // * Init swagger document
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Neo-notetaker APIs')
    .setDescription('API endpoints for Neo-notetaker webapp')
    .setVersion('1.0')
    .build();
  const documentFactory = (): OpenAPIObject =>
    SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-document', app, documentFactory, {
    swaggerOptions: { tagsSorter: 'alpha' },
  });

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(appConfig.port, () => {
    const logger: Logger = new Logger(appConfig.name);
    logger.log(`Application started at ${appConfig.host}:${appConfig.port}`);
    logger.log(`Application API prefix: ${appConfig.apiPrefix}`);
    logger.log(`Application version type: URI`);
    logger.log(
      `Swagger document URL: "${appConfig.host}:${appConfig.port}/api-document"`,
    );
  });

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
}
bootstrap();
