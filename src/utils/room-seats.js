// Turns the rows of the view v_room_seat_status into rooms that each hold their seats.
// Used by the public seat list and by the manager's room-wise seats page.
//   showPeople   - also show who lives in each seat (manager and admin only)
//   showInactive - also show rooms and seats that are switched off (manager and admin only)
function groupRoomsAndSeats(rows, { showPeople, showInactive }) {
    const rooms = [];
    const summary = { total: 0, free: 0, booked: 0, inactive: 0 };

    for (const row of rows) {
        if (!showInactive && (!row.room_is_active || row.seat_status === 'inactive')) continue;

        let room = rooms.find((r) => r.room_id === row.room_id);
        if (!room) {
            room = {
                room_id: row.room_id,
                room_no: row.room_no,
                floor_no: row.floor_no,
                has_attached_bath: row.has_attached_bath,
                has_balcony: row.has_balcony,
                is_active: row.room_is_active,
                seats: [],
            };
            rooms.push(room);
        }

        const seat = {
            seat_id: row.seat_id,
            seat_label: row.seat_label,
            monthly_rent: row.monthly_rent,
            status: row.seat_status,
        };
        if (showPeople && row.member_id) {
            seat.member = {
                member_id: row.member_id,
                full_name: row.member_name,
                phone: row.member_phone,
                member_since: row.member_since,
            };
        }
        room.seats.push(seat);

        summary.total += 1;
        if (row.seat_status === 'available') summary.free += 1;
        else if (row.seat_status === 'booked') summary.booked += 1;
        else summary.inactive += 1;
    }

    return { summary, rooms };
}

module.exports = { groupRoomsAndSeats };
