// Every error ends here and is sent to the website as JSON: { "error": "message" }.
const AppError = require('../utils/app-error');

// Which unique key was broken -> a friendly message
const duplicateMessages = {
    uq_users_email: 'This email is already registered',
    uq_users_phone: 'This phone number is already registered',
    uq_manager_profiles_nid_no: 'This NID number is already registered',
    uq_messes_manager: 'You already have a mess',
    uq_room_no: 'This room number already exists in your mess',
    uq_seat_label: 'This seat label already exists in the room',
    uq_review: 'You have already reviewed this mess',
    uq_conversation: 'This chat already exists',
};

// Errors that come from MySQL (the database rules we wrote) are turned into normal HTTP answers.
function fromMysqlError(error) {
    // our own triggers and procedures use SIGNAL SQLSTATE '45000' with a readable message
    if (error.sqlState === '45000') {
        return new AppError(400, error.sqlMessage);
    }
    switch (error.errno) {
        case 1062: { // duplicate value in a UNIQUE column
            const key = Object.keys(duplicateMessages).find((name) => error.sqlMessage.includes(name));
            return new AppError(409, key ? duplicateMessages[key] : 'This value already exists');
        }
        case 1451: // a row that is still used elsewhere cannot be deleted
            return new AppError(409, 'This record is still used by other records');
        case 1452: // a foreign key points at a row that does not exist
            return new AppError(400, 'A related record was not found');
        case 3819: // a CHECK rule failed
            return new AppError(400, 'A value is not allowed: ' + error.sqlMessage);
        default:
            return null;
    }
}

// Turns any error into an AppError with a status and a readable message, or null for a real bug.
function toAppError(error) {
    if (error instanceof AppError) return error;
    const fromDatabase = fromMysqlError(error);
    if (fromDatabase) return fromDatabase;
    // a body that is not valid JSON
    if (error.type === 'entity.parse.failed') return new AppError(400, 'The request body is not valid JSON');
    return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
    const appError = toAppError(error);

    if (!appError) {
        console.error(error); // an unexpected bug: keep the details in the log, not in the answer
        return res.status(500).json({ error: 'Something went wrong on the server' });
    }

    return res.status(appError.status).json({ error: appError.message });
}

// For a URL that does not exist
function notFound(req, res) {
    res.status(404).json({ error: 'Not found' });
}

module.exports = { errorHandler, notFound, toAppError };
