-- ====================================================================
-- v_room_seat_status
-- Every seat with its room and the person who lives in it (NULL when free).
-- Used by: Manager Room-wise seats page and the Rooms and seats section
-- of the Mess details page.
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_room_seat_status AS
SELECT r.mess_id,
       r.room_id,
       r.room_no,
       r.floor_no,
       r.has_attached_bath,
       r.has_balcony,
       r.is_active          AS room_is_active,
       s.seat_id,
       s.seat_label,
       s.monthly_rent,
       s.status             AS seat_status,
       m.member_id,
       m.full_name          AS member_name,
       m.phone              AS member_phone,
       m.join_date          AS member_since
FROM rooms AS r
JOIN seats AS s ON s.room_id = r.room_id
-- active_seat_id is filled only while a member is active, so this finds the current person
LEFT JOIN mess_members AS m ON m.active_seat_id = s.seat_id;
