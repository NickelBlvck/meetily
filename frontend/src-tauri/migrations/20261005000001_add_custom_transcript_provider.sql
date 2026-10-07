-- Custom OpenAI-compatible remote transcription provider
ALTER TABLE transcript_settings ADD COLUMN endpoint TEXT;
ALTER TABLE transcript_settings ADD COLUMN customApiKey TEXT;
