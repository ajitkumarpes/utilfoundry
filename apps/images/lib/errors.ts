/** An error whose message is safe to show the user, with the HTTP status to use. */
export class ProcessingError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "ProcessingError";
  }
}
