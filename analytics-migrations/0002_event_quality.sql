ALTER TABLE analytics_events ADD COLUMN time_quality TEXT NOT NULL DEFAULT 'client_clock';
ALTER TABLE analytics_events ADD COLUMN is_internal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE analytics_events ADD COLUMN is_suspicious INTEGER NOT NULL DEFAULT 0;
