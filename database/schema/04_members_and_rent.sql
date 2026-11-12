-- ====================================================================
-- Mess Finder database - Members, monthly rent and payments
-- Tables: mess_members, rent_dues, payments
-- Run the files in this folder in number order.
-- ====================================================================
USE mess_finder;

-- --------------------------------------------------------------------
-- mess_members: People living (or who lived) in a seat, replaces booking
-- --------------------------------------------------------------------
CREATE TABLE mess_members (
    member_id         INT NOT NULL AUTO_INCREMENT,
    seat_id           INT NOT NULL,
    student_id        INT,  -- set when linked to a student account
    full_name         VARCHAR(100) NOT NULL,
    phone             VARCHAR(20) NOT NULL,
    gender            ENUM('male','female') NOT NULL,
    occupation        VARCHAR(100),
    monthly_rent      DECIMAL(10,2) NOT NULL,  -- rent agreed at joining (a snapshot)
    advance_amount    DECIMAL(10,2) NOT NULL DEFAULT 0,  -- agreed advance, real money goes in payments
    join_date         DATE NOT NULL,
    leave_date        DATE,
    status            ENUM('active','left') NOT NULL DEFAULT 'active',
    active_seat_id    INT GENERATED ALWAYS AS (IF(status = 'active', seat_id, NULL)) STORED,  -- seat id while active, else NULL
    active_student_id INT GENERATED ALWAYS AS (IF(status = 'active', student_id, NULL)) STORED,  -- student id while active, else NULL
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT pk_mess_members PRIMARY KEY (member_id),
    CONSTRAINT uq_mess_members_active_seat UNIQUE (active_seat_id),
    CONSTRAINT uq_mess_members_active_student UNIQUE (active_student_id),
    CONSTRAINT fk_mess_members_seat FOREIGN KEY (seat_id)
        REFERENCES seats (seat_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_mess_members_student FOREIGN KEY (student_id)
        REFERENCES student_profiles (student_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_member_rent CHECK (monthly_rent > 0),  -- rent must be positive
    CONSTRAINT chk_member_adv CHECK (advance_amount >= 0),  -- advance cannot be negative
    CONSTRAINT chk_member_leave CHECK ((status = 'active' AND leave_date IS NULL) OR (status = 'left' AND leave_date IS NOT NULL AND leave_date >= join_date))  -- active: no leave date; left: leave date on or after join date
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'People living (or who lived) in a seat, replaces booking';

-- --------------------------------------------------------------------
-- rent_dues: Monthly rent due for each member (created by an event)
-- --------------------------------------------------------------------
CREATE TABLE rent_dues (
    due_id    INT NOT NULL AUTO_INCREMENT,
    member_id INT NOT NULL,
    due_month DATE NOT NULL,  -- first day of the month
    amount    DECIMAL(10,2) NOT NULL,
    due_date  DATE NOT NULL,  -- last day to pay
    status    ENUM('due','partial','paid','overdue') NOT NULL DEFAULT 'due',

    CONSTRAINT pk_rent_dues PRIMARY KEY (due_id),
    CONSTRAINT uq_member_month UNIQUE (member_id, due_month),  -- one due per member per month
    CONSTRAINT uq_due_member UNIQUE (due_id, member_id),  -- lets payments point at (due_id, member_id)
    CONSTRAINT fk_rent_dues_member FOREIGN KEY (member_id)
        REFERENCES mess_members (member_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT chk_due_month CHECK (DAY(due_month) = 1),  -- due month is always the 1st
    CONSTRAINT chk_due_amount CHECK (amount > 0),  -- amount must be positive
    CONSTRAINT chk_due_date CHECK (due_date >= due_month)  -- deadline is not before the month starts
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Monthly rent due for each member (created by an event)';

-- --------------------------------------------------------------------
-- payments: Money received from members, advance or monthly
-- --------------------------------------------------------------------
CREATE TABLE payments (
    payment_id   INT NOT NULL AUTO_INCREMENT,
    member_id    INT NOT NULL,
    due_id       INT,  -- NULL for advance payments
    amount       DECIMAL(10,2) NOT NULL,
    payment_type ENUM('advance','monthly') NOT NULL,
    method       ENUM('cash','bkash','nagad') NOT NULL,
    paid_at      DATETIME NOT NULL,

    CONSTRAINT pk_payments PRIMARY KEY (payment_id),
    CONSTRAINT fk_payments_member FOREIGN KEY (member_id)
        REFERENCES mess_members (member_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,
    CONSTRAINT fk_payments_due FOREIGN KEY (due_id, member_id)
        REFERENCES rent_dues (due_id, member_id)
        ON DELETE RESTRICT ON UPDATE NO ACTION,  -- a payment can only settle its own member's due
    CONSTRAINT chk_pay_amount CHECK (amount > 0),  -- amount must be positive
    CONSTRAINT chk_pay_due CHECK ((payment_type = 'monthly') = (due_id IS NOT NULL))  -- monthly payments need a due, advance payments must not have one
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT = 'Money received from members, advance or monthly';
