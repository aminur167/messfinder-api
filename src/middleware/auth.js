// Login checks. The website sends the token in the header:  Authorization: Bearer <token>
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { query } = require('../config/db');
const AppError = require('../utils/app-error');

// Checks a token and loads the user from the database. Returns { id, role } or null.
// The user is looked up every time, so a blocked account stops working at once.
// Both the normal requests and the real time chat (Socket.io) use this.
async function loadUserFromToken(token) {
    if (typeof token !== 'string' || token === '') return null;

    let payload;
    try {
        payload = jwt.verify(token, env.jwt.secret);
    } catch (error) {
        return null; // wrong, changed or expired token
    }

    const rows = await query('SELECT user_id, role, is_active FROM users WHERE user_id = ?', [payload.sub]);
    if (rows.length === 0 || !rows[0].is_active) return null;
    return { id: rows[0].user_id, role: rows[0].role };
}

// The token of a normal request is in the header:  Authorization: Bearer <token>
async function loadUser(req) {
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) return null;
    return loadUserFromToken(header.slice(7));
}

// The route needs a logged in user.
async function authenticate(req, res, next) {
    const user = await loadUser(req);
    if (!user) throw new AppError(401, 'Please log in');
    req.user = user;
    next();
}

// The route works for everybody, but a logged in user gets more (for example the phone number).
async function optionalAuth(req, res, next) {
    req.user = await loadUser(req);
    next();
}

// The route is only for some roles: requireRole('manager') or requireRole('student', 'manager').
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            throw new AppError(403, 'You are not allowed to do this');
        }
        next();
    };
}

// Makes the login token for a user.
function signToken(user) {
    return jwt.sign({ sub: user.user_id, role: user.role }, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

module.exports = { authenticate, optionalAuth, requireRole, signToken, loadUserFromToken };
