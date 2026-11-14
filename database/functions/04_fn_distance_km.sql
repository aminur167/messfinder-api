-- ====================================================================
-- fn_distance_km(lat1, lng1, lat2, lng2)
-- Distance between two points on the earth in kilometres (Haversine formula).
-- Used by the "Nearby" search: messes within X km of a university.
-- ====================================================================
USE mess_finder;

DROP FUNCTION IF EXISTS fn_distance_km;

DELIMITER $$
CREATE FUNCTION fn_distance_km (
    p_lat1 DECIMAL(9,6), p_lng1 DECIMAL(9,6),
    p_lat2 DECIMAL(9,6), p_lng2 DECIMAL(9,6)
)
RETURNS DECIMAL(8,2)
DETERMINISTIC
NO SQL
BEGIN
    DECLARE v_earth_radius_km DOUBLE DEFAULT 6371;
    DECLARE v_a DOUBLE;

    -- a = sin^2(dLat/2) + cos(lat1) * cos(lat2) * sin^2(dLng/2)
    SET v_a = POW(SIN(RADIANS(p_lat2 - p_lat1) / 2), 2)
            + COS(RADIANS(p_lat1)) * COS(RADIANS(p_lat2))
            * POW(SIN(RADIANS(p_lng2 - p_lng1) / 2), 2);

    -- LEAST(1, ...) protects ASIN from tiny rounding errors above 1
    RETURN ROUND(2 * v_earth_radius_km * ASIN(LEAST(1, SQRT(v_a))), 2);
END$$
DELIMITER ;
