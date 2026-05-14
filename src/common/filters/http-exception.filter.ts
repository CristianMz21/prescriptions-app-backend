/* Copyright (c) 2026. All rights reserved. */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

type ExceptionResponse = string | { message?: string | string[] };

const hasMessage = (
  response: ExceptionResponse,
): response is { message: string | string[] } => {
  if (typeof response !== 'object' || response === null) {
    return false;
  }
  return 'message' in response;
};

const extractStatus = (exception: unknown): number => {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
};

const extractResponseBody = (exception: unknown): ExceptionResponse => {
  if (exception instanceof HttpException) {
    return exception.getResponse();
  }
  return 'Internal server error';
};

const extractMessage = (
  response: ExceptionResponse,
): string | string[] | ExceptionResponse => {
  if (hasMessage(response)) {
    return response.message;
  }
  return response;
};

const isJwtException = (
  exception: unknown,
): exception is { name: string; message: string } => {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }
  if (!('name' in exception) || !('message' in exception)) {
    return false;
  }
  const { name, message } = exception;
  if (typeof name !== 'string' || typeof message !== 'string') {
    return false;
  }
  return name.includes('JsonWebToken');
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (
      exception instanceof SyntaxError &&
      exception.message.includes('JSON')
    ) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: 'Invalid JSON payload',
      });
      return;
    }

    if (isJwtException(exception)) {
      response.status(HttpStatus.UNAUTHORIZED).json({
        statusCode: HttpStatus.UNAUTHORIZED,
        timestamp: new Date().toISOString(),
        path: request.url,
        message: 'Invalid or malformed token',
      });
      return;
    }

    const status = extractStatus(exception);
    const errorResponse = extractResponseBody(exception);
    const message = extractMessage(errorResponse);

    const body = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    if (status === Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      this.logger.error(
        `[Unhandled Exception] path: ${request.url}`,
        exception,
      );
    }

    response.status(status).json(body);
  }
}
