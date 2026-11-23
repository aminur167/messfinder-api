# Mess Finder - Database

Database name: `mess_finder` (MySQL 8.0.31 or newer, InnoDB, utf8mb4).

| What | How many |
|---|---|
| Tables | 26 (42 foreign keys, 31 CHECK, 17 UNIQUE) |
| Views | 8 |
| Functions | 5 |
| Stored procedures | 9 |
| Triggers | 25 |
| Events | 4 |

## What is in each folder

| Folder | What it holds |
|---|---|
| `schema/` | `CREATE TABLE` files, one per topic. |
| `seed/` | Demo data: messes, members, rent, posts, chat and more. |
| `views/` | Saved queries the website reads like tables. |
| `functions/` | Small calculations: rating, free seats, outstanding rent, distance. |
| `procedures/` | The actions of the website that need several steps (add member, record payment...). |
| `indexes/` | Extra indexes for the most used queries. |
| `triggers/` | Rules and automatic updates that run when a row changes. |
| `events/` | Jobs MySQL runs by itself on a schedule (monthly rent, overdue, old posts). |
| `security/` | Database users and privileges. **Not** part of the automatic build, run it yourself. |
| `queries/basic/` | `01` SELECT, `02` INSERT/UPDATE/DELETE, `03` rules the database refuses. |
| `queries/advanced/` | Joins, subqueries, CTE, window functions, set operations, JSON, procedures, locking, EXPLAIN. |
| `scripts/` | Build, reset, backup and restore scripts. |
| `build/` | `mess_finder_full.sql`: every file joined into one, for MySQL Workbench. |

The build order is: schema, seed, views, functions, procedures, indexes, triggers, events.
The demo data is loaded **before** the triggers exist, so no trigger adds anything on top of it.

## How to build the database

### Option A: MySQL Workbench (easiest)

1. Connect to your local MySQL server.
2. **File > Open SQL Script** and choose `build/mess_finder_full.sql`.
3. Press the lightning button (Execute). It takes a few seconds.
4. Refresh the schema list. `mess_finder` has tables, views, routines, triggers and events.

The file never drops anything. If `mess_finder` already exists and you want a fresh copy, run `scripts/reset_database.sql` first.

### Option B: PowerShell

From the `database` folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup_database.ps1
```

It asks for your MySQL password once. Add `-Reset` to delete the old database first (it asks you to type YES). Use `-User`, `-DbHost` and `-Port` if your server is not the default.

### After you change any `.sql` file

The single build file is generated, so build it again:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build_full_script.ps1
```

### Events need the event scheduler

MySQL 8 has it switched on by default. Check with `SHOW VARIABLES LIKE 'event_scheduler';` (it should say `ON`).

## Demo logins

Every demo account has the same password: `Demo@1234`

| Role | Email | Notes |
|---|---|---|
| Admin | `admin@example.com` | |
| Manager | `abdur.rahman@example.com` | Rahman Boys Mess, Mirpur |
| Manager | `kamal.hossain@example.com` | Green Nest Mess, Dhanmondi |
| Manager | `shirin.akter@example.com` | Shanti Girls Mess, Mohammadpur |
| Manager | `mizanur.rahman@example.com` | Not verified yet, mess is waiting for the admin |
| Student | `rafiul.islam@example.com` | Lives in Rahman Boys Mess |
| Student | `rafsan.jani@example.com` | Not in a mess yet, has interests, chats and a visit |
| Student | `kabir.hossain@example.com` | Blocked account |

The demo data is set as if today is **22 November 2026**, so rent due dates and statuses make sense for that day.

## What the demo data contains

- 6 messes (4 boys, 2 girls), 20 rooms, 50 seats. One mess is still pending admin approval.
- 29 members: current members and ex-members, some with accounts and some without.
- Rent dues from January to November with every status: paid, partial, overdue and due.
- Vacancy posts, "seat wanted" posts, comments, interests, reviews with manager replies, visit requests, chat messages, complaints and notifications.

## Tables by topic

| Topic | Tables |
|---|---|
| Users and locations | `areas`, `universities`, `users`, `student_profiles`, `manager_profiles` |
| Mess setup | `messes`, `facilities`, `mess_facilities`, `mess_universities`, `rooms`, `seats`, `seat_rent_log` |
| Newsfeed and social | `vacancy_posts`, `post_seats`, `seat_wanted_posts`, `post_comments`, `interests` |
| Members and rent | `mess_members`, `rent_dues`, `payments` |
| Reviews, visits, chat | `reviews`, `visit_requests`, `conversations`, `messages` |
| Admin | `complaints`, `notifications` |

## Which page uses what

| Page | Reads | Actions |
|---|---|---|
| Browse messes | `v_mess_summary`, `v_available_seats`, `fn_distance_km` | |
| Mess details | `v_room_seat_status`, `v_mess_history`, `reviews` | `sp_toggle_interest`, `sp_get_or_create_conversation` |
| Newsfeed | `v_newsfeed` | `sp_toggle_interest`, insert into `post_comments` and `seat_wanted_posts` |
| Manager dashboard | `v_manager_stats`, `v_overdue_dues` | |
| Manager members | `v_member_dues` | `sp_add_member`, `sp_record_payment`, `sp_mark_member_left` |
| Manager room-wise seats | `v_room_seat_status` | `sp_add_member` |
| Manager posts | | `sp_create_vacancy_post` |
| Monthly jobs | | events call `sp_generate_monthly_dues`, `sp_process_overdue_dues`, `sp_expire_old_posts` |

## Main design ideas (good points to explain)

1. **One mess per manager.** `messes.manager_id` is UNIQUE.
2. **Booking is done by the manager.** The student chats or calls, then the manager adds the student as a row in `mess_members` with `sp_add_member`. There is no booking request table.
3. **Nothing important is really deleted (soft delete).** We change a status instead: user `is_active`, mess `status = 'closed'`, seat `status = 'inactive'`, member `status = 'left'`. Foreign keys use `RESTRICT`, so the database itself refuses to delete rows that have history. Only simple link rows (for example `mess_facilities`) use `CASCADE`.
4. **Composite foreign keys protect the data.**
   `student_profiles` and `manager_profiles` point at `(user_id, role)`, so a manager account cannot get a student profile.
   `payments` points at `(due_id, member_id)`, so a payment can only settle the due of the same member.
   `interests` points at `(post_id, mess_id)`, so a post from another mess cannot be used.
5. **A generated column keeps one active member per seat.** `mess_members.active_seat_id` is the seat id while the member is active and NULL after he leaves. A UNIQUE key on it stops two active members in one seat, and old members never get in the way.
6. **CHECK constraints** protect simple rules: rent above zero, rating 1 to 5, a left member must have a leave date, a monthly payment must have a due, a comment belongs to exactly one post.
7. **Triggers protect the rules that need more than one table:** a boys mess accepts only male members, only a real member can review, only the two people of a chat can write in it, a payment cannot be more than the due, and more.
8. **Triggers also keep tables in step:** adding a member books the seat, leaving frees it, a payment updates the due status, a changed rent is logged, notifications are created.
9. **Procedures use transactions and row locks.** `sp_add_member` locks the seat with `SELECT ... FOR UPDATE`, checks it, adds the member, creates the first rent due and the advance payment, and commits. Any error rolls everything back. Two managers (or two clicks) cannot take the same seat.
10. **Rent is a snapshot.** `mess_members.monthly_rent` and `rent_dues.amount` keep the rent at the time. If the seat rent changes later, old members are not affected (the change is saved in `seat_rent_log`).
11. **The monthly work runs by itself.** Events create the rent due on the 1st, mark unpaid dues overdue every day, expire old posts and cancel missed visit requests. Cursors go through the rows one by one.

## Try it

Open the files in `queries/` and run one query at a time (select it and press Ctrl+Enter).

| File | What it shows |
|---|---|
| `basic/01_select_examples.sql` | 12 plain questions with SELECT, WHERE, LIKE, BETWEEN, IN, GROUP BY |
| `basic/02_insert_update_delete.sql` | Changes that end with ROLLBACK, the data never changes |
| `basic/03_integrity_demo.sql` | 13 statements that fail on purpose (constraints) |
| `advanced/01_joins.sql` | INNER, LEFT, RIGHT, SELF and CROSS joins |
| `advanced/02_subqueries.sql` | scalar, IN, EXISTS, correlated, derived table, ALL |
| `advanced/03_aggregates_cte_window.sql` | HAVING, ROLLUP, CTE, recursive CTE, RANK, ROW_NUMBER, LAG, running total |
| `advanced/04_set_operations_and_functions.sql` | UNION, INTERSECT, EXCEPT, CASE, date, string, JSON, full-text, nearby search |
| `advanced/05_views_and_functions_demo.sql` | How the pages use the views and functions |
| `advanced/06_trigger_rules_demo.sql` | 15 statements the triggers refuse, then 5 triggers at work (rolled back) |
| `advanced/07_procedure_demo.sql` | Every procedure, step by step. **It changes data**, rebuild with `-Reset` afterwards |
| `advanced/08_transaction_and_locking_demo.sql` | SAVEPOINT, row locks with two tabs, isolation levels, deadlock |
| `advanced/09_index_explain_demo.sql` | EXPLAIN before and after an index on 200,000 rows |

## Database users (security)

The website should not log in as root. `security/01_users_and_privileges.sql` creates

- `mess_finder_app`: can SELECT, INSERT, UPDATE, DELETE and run procedures, but cannot DROP, CREATE or ALTER.
- `mess_finder_reports`: can only read.

Run it yourself as root when you are ready, and change both passwords in the file first.

## Backup and restore

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\backup_database.ps1
```

This saves tables, data, views, procedures, triggers and events in `backups\` (that folder is not pushed to GitHub). To put a backup back, into a new database name so the old one stays safe:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\restore_database.ps1 -BackupFile .\backups\your_file.sql -TargetDatabase mess_finder_copy
```

## How it was tested

Everything was run on a MySQL 8.4 server: all files build without an error, 119 automated checks pass (functions, views, every trigger rule, every procedure including failures and rollbacks, a two-session row lock test, and all four events run by the real scheduler), the privileges of both database users were tried, and a backup was restored into a copy with the same objects and data.

## If your supervisor asks for a change

| Change | Where to do it |
|---|---|
| Add or change a column or a constraint | Edit the table in the matching `schema/` file, then build again. |
| Change or add demo data | Edit the matching `seed/` file, then build again. |
| Change a rule (for example the gender rule) | Edit the file in `triggers/`. |
| Change what an action does (for example add member) | Edit the file in `procedures/`. |
| Change a number shown on a page | Edit the view in `views/`. |
| Change when a monthly job runs | Edit the file in `events/`. |

After every change, run `scripts/build_full_script.ps1`, then rebuild the database with `-Reset`.
