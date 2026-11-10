// Builds the Express application: middleware first, then the routes, then the error handlers.
const express = require('express');
const cors = require('cors');
const env = require('./config/env');
const routes = require('./routes');
const { errorHandler, notFound } = require('./middleware/error-handler');

function createApp() {
    const app = express();

    app.disable('x-powered-by');
    app.use(cors({ origin: env.clientOrigins }));
    app.use(express.json({ limit: '100kb' }));

    app.use('/api', routes);

    app.use(notFound);
    app.use(errorHandler);
    return app;
}

module.exports = createApp;
