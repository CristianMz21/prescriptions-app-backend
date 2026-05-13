import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP Exception Filter
 * Catches all exceptions thrown within the application and formats them into a consistent JSON response.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Determine the status code
    // If it's a known NestJS HttpException, extract its status.
    // Otherwise, treat it as an Internal Server Error.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Extract the error message/response from the exception if available
    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Format the message field gracefully depending on whether errorResponse is an object or a string
    const message =
      typeof errorResponse === 'object' && errorResponse !== null && 'message' in errorResponse
        ? (errorResponse as any).message
        : errorResponse;

    // Construct a consistent error response body
    const body = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: message,
    };

    // Log internal server errors (status 500) for debugging purposes
    // In production, this should ideally route to a centralized logging system (e.g., Winston, Datadog)
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      console.error(`[Unhandled Exception] path: ${request.url}`, exception);
    }

    // Send the formatted response
    response.status(status).json(body);
  }
}
