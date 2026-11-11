-- ====================================================================
-- Mess Finder database - create the database
-- This file is safe to run more than once: it never drops anything.
-- To start again from zero, use scripts/reset_database.sql first.
-- ====================================================================

CREATE DATABASE IF NOT EXISTS mess_finder
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_0900_ai_ci;

USE mess_finder;
