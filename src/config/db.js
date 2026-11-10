// One shared pool of MySQL connections. Every query in the project goes through this file.
const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    // the same collation the database uses (see schema/00_create_database.sql), otherwise
    // comparing a value we send with a text column or a view can fail with "Illegal mix of collations"
    charset: 'UTF8MB4_0900_AI_CI',
    connectionLimit: 10,
    decimalNumbers: true, // DECIMAL columns (money) arrive as numbers, not text
    dateStrings: true,    // DATE and DATETIME columns arrive as text like "2026-11-22"
});

// Runs one SQL statement and returns the rows.
// Always pass the values in the params array (the ? marks), never glue them into the text,
// so nobody can inject SQL.
async function query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
}

// Runs several statements as one transaction: all of them are saved, or none.
// The function you pass gets a connection and must use it for every statement.
async function withTransaction(work) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const result = await work(connection);
        await connection.commit();
        return result;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Gives you one connection for several statements that must run in the same session,
// for example CALL a_procedure(..., @result) followed by SELECT @result
// (a @variable lives only as long as the connection).
async function withConnection(work) {
    const connection = await pool.getConnection();
    try {
        return await work(connection);
    } finally {
        connection.release();
    }
}

module.exports = { pool, query, withTransaction, withConnection };
