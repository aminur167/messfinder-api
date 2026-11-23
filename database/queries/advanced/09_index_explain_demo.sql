-- ====================================================================
-- What does an index do? Before and after with EXPLAIN.
-- The real tables are small, so this demo makes its own table with 200,000
-- rows (a recursive CTE creates the rows) and drops it at the end.
-- ====================================================================
USE mess_finder;

SET SESSION cte_max_recursion_depth = 250000;

DROP TABLE IF EXISTS demo_index_test;

CREATE TABLE demo_index_test (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    status     VARCHAR(10) NOT NULL,
    created_at DATETIME    NOT NULL,
    note       VARCHAR(30) NOT NULL
) ENGINE = InnoDB;

-- 200,000 rows: the status goes round open, closed, expired, removed;
-- created_at spreads over 300 days.
INSERT INTO demo_index_test (status, created_at, note)
WITH RECURSIVE n AS (
    SELECT 1 AS i
    UNION ALL
    SELECT i + 1 FROM n WHERE i < 200000
)
SELECT ELT(1 + (i MOD 4), 'open', 'closed', 'expired', 'removed'),
       DATE_ADD('2026-01-01', INTERVAL (i MOD 300) DAY),
       CONCAT('row ', i)
FROM n;

SELECT COUNT(*) AS rows_in_demo_table FROM demo_index_test;


-- ---------- 1. Without an index ----------
-- type = ALL means MySQL reads every row of the table.
EXPLAIN
SELECT id, note
FROM demo_index_test
WHERE status = 'closed'
  AND created_at BETWEEN '2026-02-01' AND '2026-02-03'
ORDER BY created_at
LIMIT 20;

-- EXPLAIN ANALYZE runs the query and shows the real time (look at "actual time").
EXPLAIN ANALYZE
SELECT id, note
FROM demo_index_test
WHERE status = 'closed'
  AND created_at BETWEEN '2026-02-01' AND '2026-02-03'
ORDER BY created_at
LIMIT 20;


-- ---------- 2. Add an index on (status, created_at) ----------
ALTER TABLE demo_index_test ADD INDEX idx_demo_status_created (status, created_at);

-- Now type = range: MySQL jumps to the right place and reads only the rows it needs.
EXPLAIN
SELECT id, note
FROM demo_index_test
WHERE status = 'closed'
  AND created_at BETWEEN '2026-02-01' AND '2026-02-03'
ORDER BY created_at
LIMIT 20;

EXPLAIN ANALYZE
SELECT id, note
FROM demo_index_test
WHERE status = 'closed'
  AND created_at BETWEEN '2026-02-01' AND '2026-02-03'
ORDER BY created_at
LIMIT 20;


-- ---------- 3. The order of columns matters ----------
-- The index starts with status, so a search on created_at alone cannot use it well.
EXPLAIN
SELECT id FROM demo_index_test WHERE created_at BETWEEN '2026-02-01' AND '2026-02-03';


-- ---------- 4. Clean up ----------
DROP TABLE demo_index_test;
