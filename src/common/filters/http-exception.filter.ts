import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorBody = isHttpException
      ? exception.getResponse()
      : { message: 'Internal server error' };
    const message =
      typeof errorBody === 'string'
        ? errorBody
        : ((errorBody as { message?: string | string[] }).message ??
          'Request failed');

    this.logger.error(`${request.method} ${request.url} failed`, {
      statusCode,
      message,
    });

    response.status(statusCode).json({
      statusCode,
      message,
      error: isHttpException ? exception.name : 'InternalServerError',
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
