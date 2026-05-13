import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ExceptionResponse = string | { message?: string | string[] };

const hasMessage = (
  response: ExceptionResponse,
): response is { message: string | string[] } => {
  return (
    typeof response === 'object' && response !== null && 'message' in response
  );
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse: ExceptionResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const message = hasMessage(errorResponse)
      ? errorResponse.message
      : errorResponse;

    const body = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    if (status === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      console.error(`[Unhandled Exception] path: ${request.url}`, exception);
    }

    response.status(status).json(body);
  }
}
