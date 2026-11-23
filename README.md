# Mess Finder - Backend

A website where varsity students find a mess and mess managers advertise free seats.
Students browse messes, post "seat wanted", chat with managers and get a seat.
Managers keep their rooms, members, monthly rent and payments in one place.

This repository holds the **database** and the **Express API**.
The website pages live in the separate `frontend` repository.

## Technology

| Part | Technology |
|---|---|
| Database | MySQL 8 (plain SQL, no ORM) |
| API | Node.js and Express.js 5 |
| Chat | Socket.io 4 (real time messages) |
| Login | bcryptjs (passwords) and JSON Web Tokens |
| Database driver | mysql2 |

## Project status

| Phase | Work | State |
|---|---|---|
| 1 | Database schema (26 tables), demo data, basic queries | Done |
| 2 | Advanced SQL: views, functions, procedures, triggers, events, indexes | Done |
| 3 | Express API, chat and admin part | Done (213 automated tests) |
| 4 | Frontend | Planned |

## Run the API

1. Build the database and load the demo data, see [database/README.md](database/README.md).
2. Copy `.env.example` to `.env` and fill in `DB_PASSWORD` and a long random `JWT_SECRET`.
3. Install the packages:

```powershell
npm install
```

4. Start the server (`npm run dev` restarts it on every change):

```powershell
npm start
```

5. Open `http://localhost:5000/api/health`. It should show `{"status":"ok"}`.

Run the automated tests (they use the demo database, so do not change its data first):

```powershell
npm test
```

## Folder structure

```
backend/
|-- server.js               starts the server
|-- package.json
|-- .env.example            copy to .env and fill in your own values
|-- src/
|   |-- app.js              builds the Express app
|   |-- config/             env.js (settings) and db.js (MySQL connection pool)
|   |-- middleware/         auth.js (login check, roles) and error-handler.js
|   |-- routes/             which address goes to which controller
|   |-- socket/             chat.js, the real time chat (Socket.io)
|   |-- controllers/        the code of each endpoint (the SQL lives here)
|   `-- utils/              input checks and the AppError class
|-- tests/                  automated tests of the API
`-- database/               everything about MySQL, see database/README.md
```

## API

Every address starts with `/api`. The website sends and receives JSON.
When something goes wrong the answer is `{ "error": "message" }` with a fitting status code (400, 401, 403, 404, 409).
A logged in user sends the token in the header `Authorization: Bearer <token>`.

### Login and account

| Method and address | Who | What it does |
|---|---|---|
| `POST /auth/register` | everybody | Create a student or manager account, returns a token. |
| `POST /auth/login` | everybody | Log in, returns a token. |
| `GET /auth/me` | logged in | Own details. A student also gets the mess he lives in, a manager gets his mess. |
| `GET /health` | everybody | Is the server up and connected to MySQL? |
| `GET /reference/areas`, `/universities`, `/facilities` | everybody | Lists for forms and filters. Areas and universities can be searched, because there can be many: `?q=word`, `?limit=8`, `?id=3`. |

### Messes

| Method and address | Who | What it does |
|---|---|---|
| `GET /messes` | everybody | Mess cards. Filters: `area_id`, `type`, `min_rent`, `max_rent`, `min_rating`, `has_meal`, `utility_included`, `only_free`, `facility_ids=1,4`, `university_id`, `q`. Sorting: `sort=newest, rent_low, rent_high, rating, nearest`. Pages: `page`, `limit`. |
| `GET /messes/nearby?university_id=3&km=3` | everybody | Messes within X km of a university, nearest first, with `distance_km`. |
| `GET /messes/:id` | everybody | Details page: facilities, nearby universities, history numbers, ratings. A logged in user also gets the phone numbers and what he can do here (`viewer`). |
| `GET /messes/:id/seats` | everybody | Rooms with their seats. The manager of the mess sees who lives in each seat. |
| `GET /messes/:id/history` | everybody | Established year, total members ever, members now (numbers only). |
| `GET /messes/:id/reviews` | everybody | Reviews with "Current member" or "Ex-member" and the manager's reply. |

A mess that the admin has not verified yet is visible only to its manager and the admin.

### Newsfeed, comments and Interested

| Method and address | Who | What it does |
|---|---|---|
| `GET /newsfeed` | everybody | Vacancy posts and seat wanted posts together, newest first. Filters: `type=vacancy` or `seat_wanted`, `area_id`, `mess_type`, `status=open`. Closed and removed posts are not shown. |
| `POST /seat-wanted` | student | Make a "seat wanted" post (at most 5 open at the same time). |
| `GET /seat-wanted/my` | student | His own posts. |
| `PATCH /seat-wanted/:id/close` | student | Close his own post. |
| `GET /posts/vacancy/:id/comments`, `GET /posts/wanted/:id/comments` | everybody | The comments of a post. |
| `POST /posts/vacancy/:id/comments`, `POST /posts/wanted/:id/comments` | logged in | Write a comment (`{ "body": "..." }`). The owner of the post gets a notification. |
| `DELETE /comments/:id` | owner or admin | Hides a comment (soft delete). |
| `POST /interests/toggle` | student | The Interested button: `{ "mess_id": 1, "post_id": 3 }`. Press again to remove. |
| `GET /interests/my` | student | The messes he marked, with the chat if there is one. |

### Manager: mess, rooms, seats and posts

All these need a manager login. A manager can reach only his own mess, rooms and seats.

| Method and address | What it does |
|---|---|
| `POST /manager/mess`, `GET /manager/mess`, `PUT /manager/mess` | Create (it waits for the admin), read and change the mess with its facilities and nearby universities. |
| `POST /manager/rooms`, `PATCH /manager/rooms/:id` | Add and change a room. |
| `PATCH /manager/rooms/:id/deactivate`, `.../activate` | Switch a room off or on (not possible while members live in it). |
| `POST /manager/rooms/:id/seats` | Add a seat to a room. |
| `PATCH /manager/seats/:id/rent` | Change the rent of a seat (the old rent is logged, members keep their own rent). |
| `PATCH /manager/seats/:id/deactivate`, `.../activate` | Switch a seat off or on (not possible while a member lives in it). |
| `GET /manager/rooms-seats` | The Room-wise seats page: every room with its seats and who lives in them. |
| `POST /manager/posts`, `GET /manager/posts`, `PATCH /manager/posts/:id/close` | Vacancy posts: `{ "title", "description", "available_from", "seat_ids": [19, 18] }`. The list is in pages (`?page=1&limit=10`). |
| `GET /manager/interests` | The students who are interested in his mess. |

### Manager: members, rent and payments

The Members page. The work is done by the procedures `sp_add_member`, `sp_mark_member_left` and `sp_record_payment`, so each action is one transaction.

| Method and address | What it does |
|---|---|
| `GET /manager/dashboard` | The overview cards, the 5 members who owe the most, and a little activity. |
| `GET /manager/members` | Active members with rent numbers. Filters: `status=active or left`, `month_status`, `with_dues=1`, `q`, `sort`. Also returns `summary` for the filter chips. |
| `GET /manager/members/ex` | Ex-members with the full story (months stayed, paid, left owing). |
| `GET /manager/members/:id` | One member: every monthly due with what was paid, and every payment. |
| `POST /manager/members` | Give a seat to a person. `student_id` links an account (then name, phone and gender come from it). |
| `PATCH /manager/members/:id/leave` | The member leaves, the seat is free again. |
| `GET /manager/students/search?q=` | Find student accounts to link, with a flag if the gender fits the mess. |
| `POST /manager/payments` | Record money received. Without `due_id` it is an advance. A due can be paid in parts. |
| `GET /manager/payments`, `GET /manager/dues`, `GET /manager/dues/overdue` | Payment history, all dues and the overdue ones. |

### Visits, reviews, complaints, notifications and the student's own pages

| Method and address | Who | What it does |
|---|---|---|
| `POST /visits`, `GET /visits/my`, `PATCH /visits/:id/cancel` | student | Ask for a visit, see the requests, cancel one. |
| `GET /manager/visits`, `PATCH /manager/visits/:id/confirm`, `.../reject`, `.../complete` | manager | Answer the visit requests. The list is in pages (`?status=&page=1&limit=20`) and has `counts` with the number of requests of every status. |
| `POST /reviews` | student | Review a mess he lived in (one per mess). |
| `GET /manager/reviews`, `PATCH /manager/reviews/:id/reply` | manager | Read the reviews, reply once. |
| `GET /me/membership`, `GET /me/dues`, `GET /me/payments` | student | The My mess page: his mess, his rent month by month, his payments. |
| `POST /complaints`, `GET /complaints/my` | student, manager | Complain about a mess or a person, see own complaints. |
| `GET /notifications`, `PATCH /notifications/:id/read`, `PATCH /notifications/read-all` | everybody logged in | Notifications with `unread_count` for the bell. |
| `PATCH /auth/me`, `PATCH /auth/password` | everybody logged in | Change name, phone, profile details and password. |

### Chat

Chat is between a student and the manager of one mess. Only these two people can read it.
The history and the "open a chat" step use normal requests. The live messages use Socket.io (see below).
All these need a student or manager login.

| Method and address | What it does |
|---|---|
| `POST /conversations` | Open a chat, or find the one that exists. A student sends `{ "mess_id": 4 }`, a manager sends `{ "student_id": 8 }`. Done by the procedure `sp_get_or_create_conversation`. |
| `GET /conversations` | The inbox: title, last message, `unread_count`, newest chat first. |
| `GET /conversations/unread-count` | One number for the badge of the menu. |
| `GET /conversations/:id/messages` | Messages, oldest first, with the header of the chat and the contact numbers. `?limit=30` and `?before=<message_id>` load older messages page by page (`has_more` tells if there are more). |
| `POST /conversations/:id/messages` | Send a message with a normal request (`{ "body": "..." }`, 1 to 1000 characters). |
| `PATCH /conversations/:id/read` | Mark the messages of the other person as read. |

#### Real time part (Socket.io)

Connect to the same address as the API and send the token: `io(url, { auth: { token } })`.
A student or manager who is blocked, or has a wrong token, gets the error `Please log in`.
Every user joins a private room `user:<id>`, so all his open tabs get the same messages.

| Event | Direction | Data |
|---|---|---|
| `send_message` | browser to server | `{ conversation_id, body }`. The server answers with an acknowledgement: `{ ok: true, message }` or `{ ok: false, error }`. At most 20 messages in 10 seconds per connection. |
| `new_message` | server to both people | The saved message (`message_id`, `conversation_id`, `sender_id`, `sender_name`, `body`, `sent_at`, `is_read`). |
| `mark_read` | browser to server | `{ conversation_id }`. Answer: `{ ok: true, marked }`. |
| `messages_read` | server to the other person | `{ conversation_id, reader_id }`, so he can show "Seen". |

A message that arrives by Socket.io is saved by the same code as one sent with `POST`, so the inbox order and the
notification for the receiver (a trigger tells him once until he reads) are the same.

### Admin

All these need the admin login. The admin never sees passwords. Nothing is deleted: users are blocked, posts are hidden.

| Method and address | What it does |
|---|---|
| `GET /admin/dashboard` | Cards (users, messes, open complaints, waiting verifications) and the newest waiting managers and messes. |
| `GET /admin/reports` | Reports for the charts: messes and free seats per area, top 5 rated messes (`RANK()`), new members for the last 12 months (recursive CTE), money numbers of the whole system. |
| `GET /admin/pending` | Managers and messes that wait for approval. Each of the two lists has its own pages (`?managers_page=1&messes_page=1&limit=12`). |
| `PATCH /admin/managers/:id/verify` | Verify a manager (he gets a notification). |
| `PATCH /admin/messes/:id/verify`, `.../suspend` | Show a mess to the public, or hide it. The manager must be verified first. A trigger notifies the manager. |
| `GET /admin/users` | Users with filters `role`, `status=active or blocked`, `q`, and pages. |
| `PATCH /admin/users/:id/block`, `.../unblock` | Block or unblock a user. A blocked user is logged out at once (the token is checked against the database on every request). An admin cannot be blocked. |
| `GET /admin/complaints`, `PATCH /admin/complaints/:id` | Unfinished complaints first. Change `status` (open, in_review, resolved, dismissed) and write `admin_note`. The person who complained gets a notification. |
| `GET /admin/posts?type=vacancy or wanted`, `PATCH /admin/posts/:type/:id/remove` | Look at all posts and hide one that breaks the rules. |
| `GET /admin/comments` | The newest comments. The admin removes one with `DELETE /comments/:id`. |
