-- 001_init_chat_schema.sql
-- Relational schema for users, chats, and chat memberships (PostgreSQL / Supabase compatible)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(128) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chats (
  id VARCHAR(128) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  type VARCHAR(20) NOT NULL DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  direct_pair_key VARCHAR(300) UNIQUE,
  name VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_direct_pair_key_for_direct
    CHECK (
      (type = 'direct' AND direct_pair_key IS NOT NULL)
      OR (type = 'group' AND direct_pair_key IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS chat_members (
  chat_id VARCHAR(128) NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  user_id VARCHAR(128) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members (user_id);
CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats (updated_at DESC);

