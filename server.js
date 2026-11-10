// Starts the API and the real time chat. Run it with:  npm start   (or  npm run dev  to restart on every change)
const http = require('http');
const env = require('./src/config/env');
const { pool } = require('./src/config/db');
const createApp = require('./src/app');
const { initChat } = require('./src/socket/chat');

const server = http.createServer(createApp());
const io = initChat(server);   // Socket.io shares the same server and port

server.listen(env.port, () => {
    console.log(`Mess Finder API is running on http://localhost:${env.port}/api`);
});

// Close the connections nicely when the program is stopped (Ctrl+C)
function shutDown() {
    io.close(async () => {
        await pool.end();
        process.exit(0);
    });
}
process.on('SIGINT', shutDown);
process.on('SIGTERM', shutDown);
