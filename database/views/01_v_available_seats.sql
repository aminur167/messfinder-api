-- ====================================================================
-- v_available_seats
-- Free seats of verified messes, with the room, mess and area details.
-- Used by: Browse messes (free seat count) and the Mess details page.
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_available_seats AS
SELECT s.seat_id,
       s.seat_label,
       s.monthly_rent,
       r.room_id,
       r.room_no,
       r.floor_no,
       r.has_attached_bath,
       r.has_balcony,
       me.mess_id,
       me.mess_name,
       me.mess_type,
       a.area_id,
       a.area_name
FROM seats AS s
JOIN rooms  AS r  ON r.room_id  = s.room_id
JOIN messes AS me ON me.mess_id = r.mess_id
JOIN areas  AS a  ON a.area_id  = me.area_id
WHERE s.status = 'available'
  AND r.is_active = 1
  AND me.status = 'verified';
