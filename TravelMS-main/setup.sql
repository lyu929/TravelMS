-- Canonical tables. Use npm run setup to create the configured database and upgrade existing tables.
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL, last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE, password_hash VARCHAR(255) NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'USER', phone_number VARCHAR(20),
  avatar_key VARCHAR(20) NOT NULL DEFAULT 'initials',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS trips (
  trip_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL,
  destination VARCHAR(100) NOT NULL, start_date DATE NOT NULL, end_date DATE NOT NULL,
  purpose VARCHAR(200), status VARCHAR(32) NOT NULL DEFAULT 'PLANNED',
  estimated_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS expenses (
  expense_id INT AUTO_INCREMENT PRIMARY KEY, trip_id INT NOT NULL, user_id INT NOT NULL,
  category VARCHAR(32) NOT NULL, amount DECIMAL(10,2) NOT NULL, expense_date DATE NOT NULL,
  description VARCHAR(200), receipt_url VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS reports (
  report_id INT AUTO_INCREMENT PRIMARY KEY, trip_id INT NULL, generated_by INT NOT NULL,
  owner_id INT NULL, total_expenses DECIMAL(10,2) NOT NULL DEFAULT 0,
  report_status VARCHAR(32) NOT NULL DEFAULT 'GENERATED', snapshot JSON NULL,
  generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, approved_at DATETIME NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE SET NULL,
  FOREIGN KEY (generated_by) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash CHAR(64) PRIMARY KEY, user_id INT NOT NULL, expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX (expires_at),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS expense_receipts (
  receipt_id INT AUTO_INCREMENT PRIMARY KEY, expense_id INT NOT NULL UNIQUE,
  file_name VARCHAR(100) NOT NULL, media_type VARCHAR(100) NOT NULL,
  byte_size INT NOT NULL, sha256 CHAR(64) NOT NULL, content MEDIUMBLOB NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(expense_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS itinerary_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY, trip_id INT NOT NULL,
  item_date DATE NOT NULL, start_time VARCHAR(5) NULL,
  kind VARCHAR(20) NOT NULL DEFAULT 'ACTIVITY', title VARCHAR(100) NOT NULL,
  location VARCHAR(200) NULL, notes VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE,
  INDEX (trip_id, item_date)
);
CREATE TABLE IF NOT EXISTS trip_events (
  event_id INT AUTO_INCREMENT PRIMARY KEY, trip_id INT NOT NULL,
  actor_id INT NULL, actor_name VARCHAR(101) NOT NULL, actor_role VARCHAR(20) NOT NULL,
  event_type VARCHAR(32) NOT NULL, from_status VARCHAR(32) NULL, to_status VARCHAR(32) NULL,
  comment VARCHAR(1000) NULL, created_at DATETIME NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(trip_id) ON DELETE CASCADE,
  FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX (trip_id, event_id)
);
