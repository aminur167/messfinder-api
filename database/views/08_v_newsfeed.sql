-- ====================================================================
-- v_newsfeed
-- The newsfeed: vacancy posts (from managers) and seat wanted posts (from
-- students) in one list. UNION ALL puts the two kinds of rows under the
-- same columns. Removed posts are left out; the page sorts by created_at.
-- ====================================================================
USE mess_finder;

CREATE OR REPLACE VIEW v_newsfeed AS
SELECT 'vacancy'              AS post_type,
       vp.post_id             AS post_id,
       vp.created_at          AS created_at,
       vp.mess_id             AS mess_id,
       me.mess_name           AS author_name,
       me.manager_id          AS author_user_id,
       a.area_id              AS area_id,
       a.area_name            AS area_name,
       me.mess_type           AS mess_type,
       vp.title               AS title,
       vp.description         AS description,
       vp.available_from      AS date_from,
       CAST(NULL AS DECIMAL(10,2)) AS budget_min,
       CAST(NULL AS DECIMAL(10,2)) AS budget_max,
       vp.status              AS status,
       (SELECT COUNT(*) FROM post_comments AS pc
         WHERE pc.vacancy_post_id = vp.post_id AND pc.is_deleted = 0) AS comment_count,
       (SELECT COUNT(*) FROM interests AS i WHERE i.post_id = vp.post_id) AS interest_count
FROM vacancy_posts AS vp
JOIN messes AS me ON me.mess_id = vp.mess_id
JOIN areas  AS a  ON a.area_id  = me.area_id
WHERE vp.status <> 'removed'

UNION ALL

SELECT 'seat_wanted'          AS post_type,
       wp.wanted_id           AS post_id,
       wp.created_at          AS created_at,
       CAST(NULL AS SIGNED)   AS mess_id,
       u.full_name            AS author_name,
       wp.student_id          AS author_user_id,
       wp.area_id             AS area_id,
       a.area_name            AS area_name,
       wp.mess_type           AS mess_type,
       wp.title               AS title,
       wp.description         AS description,
       wp.needed_from         AS date_from,
       wp.budget_min          AS budget_min,
       wp.budget_max          AS budget_max,
       wp.status              AS status,
       (SELECT COUNT(*) FROM post_comments AS pc
         WHERE pc.wanted_post_id = wp.wanted_id AND pc.is_deleted = 0) AS comment_count,
       0                      AS interest_count
FROM seat_wanted_posts AS wp
JOIN users AS u ON u.user_id = wp.student_id
LEFT JOIN areas AS a ON a.area_id = wp.area_id
WHERE wp.status <> 'removed';
