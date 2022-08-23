export class HttpError extends Error {
    cause: Error
    response: Response

    constructor(message: string, errors: Error, response: Response) {
        super(message);
        this.cause = errors;
        this.response = response;
    }
}
