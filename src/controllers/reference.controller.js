// Small lists the website needs for its forms and filters.
// Areas and universities can be many, so a page does not have to load all of them: it can ask for
//   ?q=dhaka   the ones that have this word in the name
//   ?limit=8   only the first 8
//   ?id=3      only this one (to show the name of a chosen one)
// Without any of them the whole list comes, as before.
const { query } = require('../config/db');
const check = require('../utils/validate');

// Reads q, limit and id of the address. Gives the where part, its values and the limit part.
function readSearch(req, nameColumns, idColumn) {
    const q = req.query;
    const where = ['1 = 1'];
    const params = [];

    if (q.id !== undefined) {
        where.push(`${idColumn} = ?`);
        params.push(check.integer(q.id, 'Id'));
    }
    if (q.q !== undefined && String(q.q).trim() !== '') {
        const word = check.text(String(q.q), 'Search word', { max: 100 });
        const like = `%${word.replace(/[\\%_]/g, '\\$&')}%`;           // the word is searched as plain text
        where.push('(' + nameColumns.map((column) => `${column} LIKE ?`).join(' OR ') + ')');
        nameColumns.forEach(() => params.push(like));
    }

    let limitSql = '';
    if (q.limit !== undefined) {
        limitSql = ' LIMIT ?';
        params.push(check.integer(q.limit, 'Limit', { max: 50 }));
    }
    return { where: where.join(' AND '), params, limitSql };
}

// GET /api/reference/areas
async function areas(req, res) {
    const { where, params, limitSql } = readSearch(req, ['area_name'], 'area_id');
    res.json(await query(
        `SELECT area_id, area_name, city FROM areas WHERE ${where} ORDER BY area_name${limitSql}`,
        params
    ));
}

// GET /api/reference/universities
async function universities(req, res) {
    const { where, params, limitSql } = readSearch(req, ['un.short_name', 'un.name'], 'un.university_id');
    res.json(await query(
        `SELECT un.university_id, un.name, un.short_name, un.area_id, a.area_name, un.latitude, un.longitude
           FROM universities AS un
           JOIN areas AS a ON a.area_id = un.area_id
          WHERE ${where}
          ORDER BY un.short_name${limitSql}`,
        params
    ));
}

// GET /api/reference/facilities
async function facilities(req, res) {
    res.json(await query('SELECT facility_id, facility_name FROM facilities ORDER BY facility_name'));
}

module.exports = { areas, universities, facilities };
