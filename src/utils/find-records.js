// Finds the records of the logged in manager. Every manager route uses these, so a manager
// can never reach the mess, room or seat of somebody else: such a record is simply "not found".
const { query } = require('../config/db');
const AppError = require('./app-error');

// The mess of this manager (a manager has at most one).
async function getOwnMess(managerId) {
    const rows = await query('SELECT * FROM messes WHERE manager_id = ?', [managerId]);
    if (rows.length === 0) throw new AppError(404, 'You have not created your mess yet');
    return rows[0];
}

// A room, only if it belongs to the manager's mess.
async function getOwnRoom(managerId, roomId) {
    const rows = await query(
        `SELECT r.*
           FROM rooms AS r
           JOIN messes AS me ON me.mess_id = r.mess_id
          WHERE r.room_id = ? AND me.manager_id = ?`,
        [roomId, managerId]
    );
    if (rows.length === 0) throw new AppError(404, 'Room not found');
    return rows[0];
}

// A seat, only if it belongs to the manager's mess.
async function getOwnSeat(managerId, seatId) {
    const rows = await query(
        `SELECT s.*, r.mess_id
           FROM seats AS s
           JOIN rooms AS r   ON r.room_id  = s.room_id
           JOIN messes AS me ON me.mess_id = r.mess_id
          WHERE s.seat_id = ? AND me.manager_id = ?`,
        [seatId, managerId]
    );
    if (rows.length === 0) throw new AppError(404, 'Seat not found');
    return rows[0];
}

module.exports = { getOwnMess, getOwnRoom, getOwnSeat };
