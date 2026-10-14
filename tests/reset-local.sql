-- LOCAL ONLY: drops every table so the local database can be rebuilt from the migrations.
DROP TABLE IF EXISTS block_history;
DROP TABLE IF EXISTS blocks;
DROP TABLE IF EXISTS auth_failures;
DROP TABLE IF EXISTS otp_codes;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS members;
DROP TABLE IF EXISTS d1_migrations;
