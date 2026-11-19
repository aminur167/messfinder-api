// Small helpers to check what the website sends. Each one throws a 400 error with a clear message.
const AppError = require('./app-error');

// A required text value. Returns it trimmed.
function text(value, name, { min = 1, max = 255 } = {}) {
    if (typeof value !== 'string' || value.trim().length < min) {
        throw new AppError(400, `${name} is required`);
    }
    const trimmed = value.trim();
    if (trimmed.length > max) {
        throw new AppError(400, `${name} must be at most ${max} characters`);
    }
    return trimmed;
}

// A text value that may be missing. Returns null when empty.
function optionalText(value, name, { max = 255 } = {}) {
    if (value === undefined || value === null || String(value).trim() === '') return null;
    return text(String(value), name, { max });
}

function email(value) {
    const address = text(value, 'Email', { max: 120 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
        throw new AppError(400, 'Email is not valid');
    }
    return address;
}

// Bangladesh mobile number. +8801712345678, 8801712345678 and 01712345678 all become 01712345678.
function phone(value) {
    const cleaned = text(value, 'Phone', { max: 20 }).replace(/[\s-]/g, '');
    const match = cleaned.match(/^(?:\+?88)?(01[3-9]\d{8})$/);
    if (!match) {
        throw new AppError(400, 'Phone must be a Bangladeshi mobile number like 01712345678');
    }
    return match[1];
}

function password(value) {
    if (typeof value !== 'string' || value.length < 8 || value.length > 72) {
        throw new AppError(400, 'Password must be 8 to 72 characters');
    }
    if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
        throw new AppError(400, 'Password must contain a letter and a number');
    }
    return value;
}

// One of the allowed words, for example gender: male or female.
function oneOf(value, name, allowed) {
    if (!allowed.includes(value)) {
        throw new AppError(400, `${name} must be one of: ${allowed.join(', ')}`);
    }
    return value;
}

// A whole number, for example an id. Required unless fallback is given.
function integer(value, name, { min = 1, max = 2147483647, fallback } = {}) {
    if ((value === undefined || value === '') && fallback !== undefined) return fallback;
    const number = Number(value);
    if (!Number.isInteger(number) || number < min || number > max) {
        throw new AppError(400, `${name} must be a whole number${min === 1 ? ' above zero' : ''}`);
    }
    return number;
}

// A number, for example a rent. Returns undefined when it was not sent.
function optionalNumber(value, name, { min = 0, max = 1e9 } = {}) {
    if (value === undefined || value === '') return undefined;
    const number = Number(value);
    if (!Number.isFinite(number) || number < min || number > max) {
        throw new AppError(400, `${name} must be a number from ${min} to ${max}`);
    }
    return number;
}

// "1,3,5" -> [1, 3, 5]
function idList(value, name) {
    if (value === undefined || value === '') return [];
    return String(value).split(',').map((part) => integer(part.trim(), name));
}

// A number that must be sent, for example a rent.
function number(value, name, { min = 0, max = 1e9 } = {}) {
    const checked = optionalNumber(value, name, { min, max });
    if (checked === undefined) throw new AppError(400, `${name} is required`);
    return checked;
}

// Yes or no. Accepts true/false and 1/0. Returns 1 or 0 (what MySQL BOOLEAN stores).
function flag(value, name, { fallback = 0 } = {}) {
    if (value === undefined || value === null || value === '') return fallback;
    if (value === true || value === 1 || value === '1' || value === 'true') return 1;
    if (value === false || value === 0 || value === '0' || value === 'false') return 0;
    throw new AppError(400, `${name} must be true or false`);
}

// A date like 2026-12-01. Returns the same text.
function date(value, name) {
    const checked = text(String(value ?? ''), name, { max: 10 });
    const parsed = new Date(checked + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(checked) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== checked) {
        throw new AppError(400, `${name} must be a date like 2026-12-01`);
    }
    return checked;
}

// A date and time like 2026-12-01 18:30 (also 2026-12-01T18:30 or with seconds).
// Returns it in the form MySQL likes: 2026-12-01 18:30:00
function dateTime(value, name) {
    const checked = text(String(value ?? ''), name, { max: 25 });
    const match = checked.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) throw new AppError(400, `${name} must be a date and time like 2026-12-01 18:30`);
    const day = date(match[1], name);
    const hour = Number(match[2]);
    const minute = Number(match[3]);
    const second = Number(match[4] || 0);
    if (hour > 23 || minute > 59 || second > 59) {
        throw new AppError(400, `${name} must be a date and time like 2026-12-01 18:30`);
    }
    return `${day} ${match[2]}:${match[3]}:${String(second).padStart(2, '0')}`;
}

// A whole number that may be missing. Returns null when it was not sent.
function optionalInteger(value, name, options) {
    if (value === undefined || value === null || value === '') return null;
    return integer(value, name, options);
}

// A list of whole numbers sent as a JSON array, for example [1, 4, 5]. Duplicates are removed.
function integerArray(value, name, { max = 100 } = {}) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > max) {
        throw new AppError(400, `${name} must be a list of up to ${max} numbers`);
    }
    return [...new Set(value.map((item) => integer(item, name)))];
}

module.exports = {
    text, optionalText, email, phone, password, oneOf, integer, optionalNumber, number, idList,
    flag, date, dateTime, optionalInteger, integerArray,
};
