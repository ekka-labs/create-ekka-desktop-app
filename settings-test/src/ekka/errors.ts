/**
 * EKKA Client Errors
 * DO NOT EDIT - Managed by EKKA
 */

export class EkkaError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'EkkaError';
    this.code = code;
  }
}

export class EkkaNotConnectedError extends EkkaError {
  constructor() {
    super('Not connected. Call ekka.connect() first.', 'NOT_CONNECTED');
  }
}

export class EkkaConnectionError extends EkkaError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR');
  }
}

export class EkkaApiError extends EkkaError {
  httpStatus?: number;

  constructor(message: string, code: string, httpStatus?: number) {
    super(message, code);
    this.name = 'EkkaApiError';
    this.httpStatus = httpStatus;
  }
}
