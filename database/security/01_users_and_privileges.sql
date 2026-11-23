-- ====================================================================
-- Database users and privileges
--
-- The website should not log in to MySQL as root. It gets its own user that can
-- only work with the data of mess_finder: no DROP, no ALTER, no other database.
-- A second user can only read, for reports.
--
-- This file is NOT part of the automatic build, because it creates users on your
-- server. Run it yourself (as root) when you are ready:
--     Workbench: open this file and press the lightning button.
--
-- IMPORTANT: change both passwords before you use them, and put the app password
-- in backend/.env (DB_USER and DB_PASSWORD).
-- ====================================================================
USE mess_finder;

-- 1. The user of the website (the Express backend)
CREATE USER IF NOT EXISTS 'mess_finder_app'@'localhost'
    IDENTIFIED BY 'ChangeThisPassword#1';

GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE
   ON mess_finder.*
   TO 'mess_finder_app'@'localhost';

-- 2. A read-only user for reports and for showing data to someone
CREATE USER IF NOT EXISTS 'mess_finder_reports'@'localhost'
    IDENTIFIED BY 'ChangeThisPassword#2';

GRANT SELECT
   ON mess_finder.*
   TO 'mess_finder_reports'@'localhost';

-- 3. See what each user may do
SHOW GRANTS FOR 'mess_finder_app'@'localhost';
SHOW GRANTS FOR 'mess_finder_reports'@'localhost';

-- 4. Take a privilege away (example): the website may no longer delete anything
-- REVOKE DELETE ON mess_finder.* FROM 'mess_finder_app'@'localhost';

-- 5. Change a password later
-- ALTER USER 'mess_finder_app'@'localhost' IDENTIFIED BY 'a-new-strong-password';

-- 6. Remove the users again
-- DROP USER 'mess_finder_app'@'localhost';
-- DROP USER 'mess_finder_reports'@'localhost';
