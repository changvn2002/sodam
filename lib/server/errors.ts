/** HTTP error carrying a status code — the route handlers turn it into `{ message }` JSON, mirroring the original NestJS exception responses. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function notFound(message: string) {
  return new HttpError(404, message);
}

export function badRequest(message: string) {
  return new HttpError(400, message);
}
