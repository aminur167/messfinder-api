// An error we throw on purpose, with the HTTP status the website should receive.
// Example: throw new AppError(404, 'Mess not found');
class AppError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

module.exports = AppError;
