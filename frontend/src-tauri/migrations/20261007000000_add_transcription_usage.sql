-- Cumulative token usage for remote (API) transcription, "​/usage" analog.
-- Single-row table (id = 1) holding running totals across all meetings.
CREATE TABLE IF NOT EXISTS transcription_usage (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    input_tokens INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    requests INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
