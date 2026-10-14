-- Portfolio: one owner who administers the site, and the site content as JSON sections.

CREATE TABLE IF NOT EXISTS members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role = 'admin'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at INTEGER NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  password_set_at INTEGER
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- SHA-256 of the cookie token; the token itself is never stored
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  user_agent TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_sessions_member ON sessions(member_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_codes(email, created_at);

CREATE TABLE IF NOT EXISTS auth_failures (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,               -- an email address, or "ip:<address>" for lookups of unknown addresses
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_failures ON auth_failures(email, created_at);

-- Each editable section of the portfolio (profile, agentic work, experience, ...) is one JSON document.
CREATE TABLE IF NOT EXISTS blocks (
  key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Earlier versions of each section, so any save can be undone from the admin console.
CREATE TABLE IF NOT EXISTS block_history (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  data TEXT NOT NULL,
  saved_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_key ON block_history(key, saved_at);

-- The owner. The password is set on the first sign-in with a code emailed to this address.
INSERT OR IGNORE INTO members (id, name, email, role, status, created_at) VALUES ('m_owner', 'Moinak Ghosh', 'moinak023@gmail.com', 'admin', 'active', 1760400000000);
