-- ====================================================================
-- v_mess_history
-- The "History" section of the Mess details page: only numbers, no names.
-- (The names of ex-members are shown to the manager only.)
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_mess_history AS
SELECT me.mess_id,
       me.established_year,
       COUNT(m.member_id)                 AS total_members_ever,
       COALESCE(SUM(m.status = 'active'), 0) AS current_members
FROM messes AS me
LEFT JOIN rooms AS r ON r.mess_id = me.mess_id
LEFT JOIN seats AS s ON s.room_id = r.room_id
LEFT JOIN mess_members AS m ON m.seat_id = s.seat_id
GROUP BY me.mess_id, me.established_year;
