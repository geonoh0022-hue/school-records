CREATE TABLE IF NOT EXISTS teacher_workspace (
  id integer PRIMARY KEY CHECK (id=1),
  revision integer NOT NULL DEFAULT 0,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO teacher_workspace(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
CREATE TABLE IF NOT EXISTS teacher_fonts (
  id text PRIMARY KEY,
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
