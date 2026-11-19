// Register, login and "who am I".
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../config/db');
const { signToken } = require('../middleware/auth');
const AppError = require('../utils/app-error');
const check = require('../utils/validate');

// When the email does not exist we still compare against this hash,
// so a wrong email and a wrong password take the same time and give the same answer.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// What the website may know about a user (never the password hash).
function publicUser(user) {
    return {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
    };
}

// "Green University of Bangladesh" -> "GUB" (the short name of a university that a student adds)
function shortNameOf(name) {
    const small = ['of', 'and', 'the', 'for', 'in'];
    const letters = name.split(/\s+/)
        .filter((word) => word !== '' && !small.includes(word.toLowerCase()))
        .map((word) => word[0].toUpperCase())
        .join('');
    return (letters || name).slice(0, 20);
}

// A student whose university is not in the list can add it when he registers.
// If a university with this name exists it is used (so nobody adds the same one twice).
// The place of a new university is not known, so it gets the average place of the other universities of the
// same area (the Nearby search needs a place). The admin can see it in the list like any other.
async function findOrCreateUniversity(connection, input) {
    const [same] = await connection.query('SELECT university_id FROM universities WHERE name = ?', [input.name]);
    if (same.length > 0) return same[0].university_id;

    const [existingArea] = await connection.query('SELECT area_id FROM areas WHERE LOWER(area_name) = LOWER(?)', [input.areaName]);
    let areaId = existingArea.length ? existingArea[0].area_id : null;
    if (!areaId) {
        const [createdArea] = await connection.query('INSERT INTO areas (area_name) VALUES (?)', [input.areaName]);
        areaId = createdArea.insertId;
    }

    let [places] = await connection.query('SELECT AVG(latitude) AS lat, AVG(longitude) AS lng FROM universities WHERE area_id = ?', [areaId]);
    if (places[0].lat === null) {
        [places] = await connection.query('SELECT AVG(latitude) AS lat, AVG(longitude) AS lng FROM universities');
    }
    const latitude = places[0].lat === null ? 23.8103 : Number(places[0].lat);
    const longitude = places[0].lng === null ? 90.4125 : Number(places[0].lng);

    const [result] = await connection.query(
        'INSERT INTO universities (name, short_name, area_id, latitude, longitude) VALUES (?, ?, ?, ?, ?)',
        [input.name, shortNameOf(input.name), areaId, latitude, longitude]
    );
    return result.insertId;
}

// POST /api/auth/register
async function register(req, res) {
    const body = req.body || {};

    const role = check.oneOf(body.role, 'Role', ['student', 'manager']);
    const fullName = check.text(body.full_name, 'Full name', { min: 2, max: 100 });
    const email = check.email(body.email);
    const phone = check.phone(body.phone);
    const passwordText = check.password(body.password);

    // the extra details of each role
    let profile;
    if (role === 'student') {
        // Students can enter any university and area; existing names are reused when possible.
        const newUniversity = {
            name: check.text(body.university_name, 'University name', { min: 3, max: 150 }),
            areaName: check.text(body.area_name, 'Area', { min: 2, max: 80 }),
        };
        profile = {
            newUniversity,
            gender: check.oneOf(body.gender, 'Gender', ['male', 'female']),
            roll: check.optionalText(body.student_roll, 'Student roll', { max: 30 }),
            department: check.optionalText(body.department, 'Department', { max: 80 }),
        };
    } else {
        const nid = check.text(body.nid_no, 'NID number', { max: 20 });
        if (!/^\d{10,17}$/.test(nid)) {
            throw new AppError(400, 'NID number must be 10 to 17 digits');
        }
        profile = { nid, address: check.optionalText(body.address, 'Address') };
    }

    const passwordHash = await bcrypt.hash(passwordText, 10);

    // the user and the profile are saved together, or not at all
    const userId = await withTransaction(async (connection) => {
        const [result] = await connection.query(
            'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
            [fullName, email, phone, passwordHash, role]
        );

        if (role === 'student') {
            const universityId = await findOrCreateUniversity(connection, profile.newUniversity);
            await connection.query(
                'INSERT INTO student_profiles (student_id, university_id, student_roll, department, gender) VALUES (?, ?, ?, ?, ?)',
                [result.insertId, universityId, profile.roll, profile.department, profile.gender]
            );
        } else {
            await connection.query(
                'INSERT INTO manager_profiles (manager_id, nid_no, address) VALUES (?, ?, ?)',
                [result.insertId, profile.nid, profile.address]
            );
        }
        return result.insertId;
    });

    const user = { user_id: userId, full_name: fullName, email, phone, role };
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
}

// POST /api/auth/login
async function login(req, res) {
    const body = req.body || {};
    const email = check.email(body.email);
    if (typeof body.password !== 'string' || body.password === '') {
        throw new AppError(400, 'Password is required');
    }

    const rows = await query(
        'SELECT user_id, full_name, email, phone, role, password_hash, is_active FROM users WHERE email = ?',
        [email]
    );
    const user = rows[0];

    const passwordOk = await bcrypt.compare(body.password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !passwordOk) {
        throw new AppError(401, 'Wrong email or password');
    }
    if (!user.is_active) {
        throw new AppError(403, 'Your account is blocked. Please contact the admin');
    }

    res.json({ token: signToken(user), user: publicUser(user) });
}

// GET /api/auth/me  (needs a token)
async function me(req, res) {
    res.json(await loadMe(req.user.id));
}

// PATCH /api/auth/me
// Changes the name and phone, and the profile details of the role:
// student: university_id, student_roll, department. manager: address.
// Email, role and gender cannot be changed here. Only the fields that are sent are changed.
async function updateProfile(req, res) {
    const body = req.body || {};
    const userId = req.user.id;

    const changes = [];
    const values = [];
    if (body.full_name !== undefined) {
        changes.push('full_name = ?');
        values.push(check.text(body.full_name, 'Full name', { min: 2, max: 100 }));
    }
    if (body.phone !== undefined) {
        changes.push('phone = ?');
        values.push(check.phone(body.phone));
    }

    const profileChanges = [];
    const profileValues = [];
    if (req.user.role === 'student') {
        if (body.university_id !== undefined) {
            profileChanges.push('university_id = ?');
            profileValues.push(check.integer(body.university_id, 'University'));
        }
        if (body.student_roll !== undefined) {
            profileChanges.push('student_roll = ?');
            profileValues.push(check.optionalText(body.student_roll, 'Student roll', { max: 30 }));
        }
        if (body.department !== undefined) {
            profileChanges.push('department = ?');
            profileValues.push(check.optionalText(body.department, 'Department', { max: 80 }));
        }
    } else if (req.user.role === 'manager' && body.address !== undefined) {
        profileChanges.push('address = ?');
        profileValues.push(check.optionalText(body.address, 'Address'));
    }

    if (changes.length === 0 && profileChanges.length === 0) {
        throw new AppError(400, 'Nothing to change');
    }

    await withTransaction(async (connection) => {
        if (changes.length > 0) {
            await connection.query(`UPDATE users SET ${changes.join(', ')} WHERE user_id = ?`, [...values, userId]);
        }
        if (profileChanges.length > 0) {
            const table = req.user.role === 'student' ? 'student_profiles' : 'manager_profiles';
            const idColumn = req.user.role === 'student' ? 'student_id' : 'manager_id';
            await connection.query(`UPDATE ${table} SET ${profileChanges.join(', ')} WHERE ${idColumn} = ?`, [...profileValues, userId]);
        }
    });

    res.json(await loadMe(userId));
}

// PATCH /api/auth/password   { "current_password": "...", "new_password": "..." }
async function changePassword(req, res) {
    const body = req.body || {};
    if (typeof body.current_password !== 'string' || body.current_password === '') {
        throw new AppError(400, 'Current password is required');
    }
    const newPassword = check.password(body.new_password);

    const rows = await query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.id]);
    if (!(await bcrypt.compare(body.current_password, rows[0].password_hash))) {
        throw new AppError(401, 'Your current password is wrong');
    }

    await query('UPDATE users SET password_hash = ? WHERE user_id = ?', [await bcrypt.hash(newPassword, 10), req.user.id]);
    res.json({ changed: true });
}

// The details of one user, ready to send. The role decides which extra parts are added.
async function loadMe(userId) {
    const rows = await query(
        'SELECT user_id, full_name, email, phone, role, created_at FROM users WHERE user_id = ?',
        [userId]
    );
    const user = rows[0];
    const answer = { ...publicUser(user), created_at: user.created_at };

    if (user.role === 'student') {
        const profiles = await query(
            `SELECT sp.university_id, un.name AS university_name, un.short_name AS university_short_name,
                    sp.student_roll, sp.department, sp.gender
               FROM student_profiles AS sp
               JOIN universities AS un ON un.university_id = sp.university_id
              WHERE sp.student_id = ?`,
            [user.user_id]
        );
        // the mess the student lives in right now, if the manager linked the account
        const membership = await query(
            `SELECT m.member_id, me.mess_id, me.mess_name, r.room_no, s.seat_label, m.monthly_rent, m.join_date
               FROM mess_members AS m
               JOIN seats AS s   ON s.seat_id  = m.seat_id
               JOIN rooms AS r   ON r.room_id  = s.room_id
               JOIN messes AS me ON me.mess_id = r.mess_id
              WHERE m.student_id = ? AND m.status = 'active'`,
            [user.user_id]
        );
        answer.profile = profiles[0];
        answer.membership = membership[0] || null;
    }

    if (user.role === 'manager') {
        const profiles = await query(
            'SELECT nid_no, address, is_verified FROM manager_profiles WHERE manager_id = ?',
            [user.user_id]
        );
        const messes = await query(
            'SELECT mess_id, mess_name, status FROM messes WHERE manager_id = ?',
            [user.user_id]
        );
        answer.profile = profiles[0];
        answer.mess = messes[0] || null; // null until the manager creates the mess
    }

    return answer;
}

module.exports = { register, login, me, updateProfile, changePassword };
