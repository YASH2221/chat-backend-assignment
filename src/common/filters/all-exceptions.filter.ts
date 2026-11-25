import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface PgErrorShape {
  code?: string;
  detail?: string;
  constraint?: string;
}

function isPgError(err: unknown): err is PgErrorShape {
  return typeof err === 'object' && err !== null && 'code' in err;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const resBody = exception.getResponse();
      if (typeof resBody === 'string') {
        message = resBody;
        error = exception.name;
      } else if (typeof resBody === 'object' && resBody !== null) {
        const bodyObj = resBody as { message?: string | string[]; error?: string };
        message = bodyObj.message ?? exception.message;
        error = bodyObj.error ?? exception.name;
      }
    } else if (isPgError(exception) && typeof exception.code === 'string') {
      const mapped = this.mapPostgresError(exception);
      statusCode = mapped.statusCode;
      message = mapped.message;
      error = mapped.error;
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled error on ${request.method} ${request.url}`, exception.stack);
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapPostgresError(pgErr: PgErrorShape): {
    statusCode: number;
    error: string;
    message: string;
  } {
    switch (pgErr.code) {
      case '23505':
        return {
          statusCode: HttpStatus.CONFLICT,
          error: 'Conflict',
          message: 'Resource already exists (unique constraint violation)',
        };
      case '23503':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Referenced resource does not exist',
        };
      case '22P02':
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'Bad Request',
          message: 'Invalid identifier format',
        };
      default:
        return {
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          error: 'Database Error',
          message: 'A database error occurred',
        };
    }
  }
}
