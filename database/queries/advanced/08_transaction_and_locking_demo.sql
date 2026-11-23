-- ====================================================================
-- Transactions, SAVEPOINT, locking and isolation levels
-- A transaction groups statements: either all of them are saved (COMMIT)
-- or none of them (ROLLBACK).
-- ====================================================================
USE mess_finder;


-- ---------- Part 1: COMMIT, ROLLBACK and SAVEPOINT (one connection) ----------
-- Select the whole block and run it. Nothing stays, the block ends with ROLLBACK.

START TRANSACTION;

UPDATE seats SET monthly_rent = 3100 WHERE seat_id = 1;          -- step 1
SAVEPOINT after_first_change;                                     -- a bookmark

UPDATE seats SET monthly_rent = 9999 WHERE seat_id = 2;          -- step 2 (a mistake)
SELECT seat_id, monthly_rent FROM seats WHERE seat_id IN (1, 2);  -- both changed

ROLLBACK TO after_first_change;                                   -- undo only step 2
SELECT seat_id, monthly_rent FROM seats WHERE seat_id IN (1, 2);  -- seat 1 = 3100, seat 2 is back

ROLLBACK;                                                         -- undo everything
SELECT seat_id, monthly_rent FROM seats WHERE seat_id IN (1, 2);  -- 3000 and 3000 again


-- ---------- Part 2: row locks with two connections ----------
-- This needs TWO query tabs in Workbench, both connected to the same server.
-- It shows why sp_add_member locks the seat before it checks it.
--
-- Tab A (run it first, then go to tab B quickly):
--     START TRANSACTION;
--     SELECT * FROM seats WHERE seat_id = 7 FOR UPDATE;     -- tab A now owns the row
--     (do not commit yet)
--
-- Tab B:
--     START TRANSACTION;
--     SELECT * FROM seats WHERE seat_id = 7 FOR UPDATE;     -- tab B WAITS here
--
-- Tab A (after about 10 seconds):
--     COMMIT;                                                -- tab B continues now
--
-- Tab B:
--     COMMIT;
--
-- If tab A never commits, tab B stops waiting after innodb_lock_wait_timeout (50 s)
-- with: Error 1205: Lock wait timeout exceeded.
SHOW VARIABLES LIKE 'innodb_lock_wait_timeout';

-- Plain SELECT does not wait: tab B can read the seat while tab A holds the lock
--     SELECT * FROM seats WHERE seat_id = 7;                 -- answers at once

-- See who is waiting for whom (run in a third tab while A and B are stuck):
SELECT * FROM performance_schema.data_lock_waits;


-- ---------- Part 3: isolation levels ----------
-- The isolation level decides what one transaction sees of another one's changes.
SELECT @@transaction_isolation AS current_level;                  -- REPEATABLE-READ is the MySQL default

-- Change it for your own connection only:
SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;
SELECT @@transaction_isolation AS current_level;
SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- Try it with two tabs:
--   Tab A:  START TRANSACTION;
--           SELECT monthly_rent FROM seats WHERE seat_id = 1;           -- 3000
--   Tab B:  UPDATE seats SET monthly_rent = 3300 WHERE seat_id = 1;     -- autocommit saves it
--   Tab A:  SELECT monthly_rent FROM seats WHERE seat_id = 1;
--             REPEATABLE READ  -> still 3000 (A keeps its first picture of the data)
--             READ COMMITTED   -> 3300 (A sees what B saved)
--           COMMIT;
--   Tab B:  UPDATE seats SET monthly_rent = 3000 WHERE seat_id = 1;     -- put it back


-- ---------- Part 4: a deadlock (two transactions wait for each other) ----------
-- Tab A:  START TRANSACTION;  UPDATE seats SET monthly_rent = 3000 WHERE seat_id = 1;
-- Tab B:  START TRANSACTION;  UPDATE seats SET monthly_rent = 3000 WHERE seat_id = 2;
-- Tab A:  UPDATE seats SET monthly_rent = 3000 WHERE seat_id = 2;      -- waits for B
-- Tab B:  UPDATE seats SET monthly_rent = 3000 WHERE seat_id = 1;      -- now both wait for each other
--   MySQL notices and cancels one of them: Error 1213: Deadlock found when trying to get lock.
--   The other one continues. The cancelled one must be started again.
-- Tab A and B: ROLLBACK;
