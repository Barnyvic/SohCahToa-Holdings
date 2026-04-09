import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class SuccessResponseInterceptor<T> implements NestInterceptor<
  T,
  unknown
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<{ url: string; method: string }>();
    const response = http.getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((data) => {
        const statusCode =
          typeof response.statusCode === 'number' && response.statusCode > 0
            ? response.statusCode
            : request.method === 'POST'
              ? HttpStatus.CREATED
              : HttpStatus.OK;

        return {
          statusCode,
          success: true,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
        };
      }),
    );
  }
}
