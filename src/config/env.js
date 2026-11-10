// Reads the settings from the .env file (or from the environment) in one place.
// The rest of the code uses this file, so it never touches process.env directly.
require('dotenv').config({ quiet: true });

const env = {
    port: Number(process.env.PORT) || 5000,

    // The websites that may call this API. Several addresses can be separated by commas.
    clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5500,http://127.0.0.1:5500')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),

    db: {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'mess_finder',
    },

    jwt: {
        secret: process.env.JWT_SECRET,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    },
};

// Without a secret nobody can sign login tokens, so stop early with a clear message.
if (!env.jwt.secret) {
    throw new Error('JWT_SECRET is missing. Copy .env.example to .env and set it.');
}

module.exports = env;
