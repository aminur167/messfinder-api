-- ====================================================================
-- v_mess_summary
-- One row per mess with everything the mess card needs: area, rent range,
-- free seats and rating. Seats that are inactive are not counted.
-- Used by: Browse messes, Home page (top rated), Interested list.
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_mess_summary AS
SELECT me.mess_id,
       me.manager_id,
       me.mess_name,
       me.mess_type,
       me.address,
       me.status,
       me.has_meal,
       me.meal_cost_monthly,
       me.utility_included,
       me.advance_amount,
       me.latitude,
       me.longitude,
       a.area_id,
       a.area_name,
       COALESCE(ss.total_seats, 0)  AS total_seats,
       COALESCE(ss.free_seats, 0)   AS free_seats,
       ss.min_rent,
       ss.max_rent,
       rv.avg_rating,
       COALESCE(rv.review_count, 0) AS review_count
FROM messes AS me
JOIN areas AS a ON a.area_id = me.area_id
LEFT JOIN (
    -- seat numbers per mess
    SELECT r.mess_id,
           COUNT(*)                     AS total_seats,
           SUM(s.status = 'available')  AS free_seats,
           MIN(s.monthly_rent)          AS min_rent,
           MAX(s.monthly_rent)          AS max_rent
    FROM rooms AS r
    JOIN seats AS s ON s.room_id = r.room_id
    WHERE r.is_active = 1 AND s.status <> 'inactive'
    GROUP BY r.mess_id
) AS ss ON ss.mess_id = me.mess_id
LEFT JOIN (
    -- rating numbers per mess
    SELECT mess_id,
           ROUND(AVG(rating), 2) AS avg_rating,
           COUNT(*)              AS review_count
    FROM reviews
    GROUP BY mess_id
) AS rv ON rv.mess_id = me.mess_id;
