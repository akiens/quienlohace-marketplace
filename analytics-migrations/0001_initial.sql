PRAGMA foreign_keys = ON;

CREATE TABLE analytics_sessions (
  session_id TEXT PRIMARY KEY,
  first_received_at TEXT NOT NULL,
  last_received_at TEXT NOT NULL,
  first_occurred_at TEXT NOT NULL,
  last_occurred_at TEXT NOT NULL,
  capture_policy_version INTEGER NOT NULL
) STRICT;

CREATE TABLE analytics_segments (
  segment_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  tab_id TEXT NOT NULL,
  segment_sequence INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  last_activity_at TEXT NOT NULL,
  close_reason TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  event_count INTEGER NOT NULL,
  dropped_events INTEGER NOT NULL DEFAULT 0,
  payload_hash TEXT NOT NULL,
  received_at TEXT NOT NULL,
  country_code TEXT,
  region_code TEXT,
  UNIQUE (session_id, tab_id, segment_sequence)
) STRICT;

CREATE TABLE analytics_events (
  event_id TEXT PRIMARY KEY,
  segment_id TEXT,
  event_name TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  collector_version TEXT NOT NULL,
  app_release TEXT NOT NULL,
  environment TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  client_sequence INTEGER,
  monotonic_ms REAL,
  source TEXT NOT NULL,
  observation_kind TEXT NOT NULL,
  session_id TEXT,
  tab_id TEXT,
  page_view_id TEXT,
  previous_page_view_id TEXT,
  search_id TEXT,
  previous_search_id TEXT,
  search_execution_id TEXT,
  result_set_id TEXT,
  list_view_id TEXT,
  result_item_id TEXT,
  impression_id TEXT,
  interaction_id TEXT,
  source_interaction_id TEXT,
  entity_type TEXT,
  provider_profile_id TEXT,
  profile_service_id TEXT,
  service_card_id TEXT,
  specialty_id TEXT,
  service_sector_id TEXT,
  entity_snapshot_id TEXT,
  page_type TEXT,
  surface TEXT,
  component_id TEXT,
  placement TEXT,
  ui_version TEXT NOT NULL,
  privacy_policy_version INTEGER NOT NULL,
  capture_policy_version INTEGER NOT NULL,
  country_code TEXT,
  region_code TEXT,
  sample_rate REAL NOT NULL DEFAULT 1,
  entity_resolution_status TEXT NOT NULL,
  properties_json TEXT NOT NULL CHECK (json_valid(properties_json)),
  payload_hash TEXT NOT NULL,
  archived_manifest_id TEXT,
  FOREIGN KEY (segment_id) REFERENCES analytics_segments(segment_id)
) STRICT;

CREATE TABLE analytics_search_queries (
  event_id TEXT PRIMARY KEY,
  search_id TEXT,
  query_sanitized TEXT,
  query_normalized TEXT,
  query_tokens_json TEXT CHECK (query_tokens_json IS NULL OR json_valid(query_tokens_json)),
  capture_status TEXT NOT NULL,
  redaction_code TEXT,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES analytics_events(event_id) ON DELETE CASCADE
) STRICT;

CREATE TABLE analytics_search_executions (
  search_execution_id TEXT PRIMARY KEY,
  search_id TEXT,
  result_set_id TEXT NOT NULL,
  executed_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT NOT NULL,
  total_results INTEGER NOT NULL,
  provider_total INTEGER NOT NULL,
  ranking_version TEXT NOT NULL,
  interpretation_json TEXT NOT NULL CHECK (json_valid(interpretation_json))
) STRICT;

CREATE TABLE analytics_result_sets (
  result_set_id TEXT PRIMARY KEY,
  search_execution_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  total_count INTEGER NOT NULL,
  delivered_count INTEGER NOT NULL,
  ranking_version TEXT NOT NULL,
  FOREIGN KEY (search_execution_id) REFERENCES analytics_search_executions(search_execution_id)
) STRICT;

CREATE TABLE analytics_result_items (
  result_item_id TEXT PRIMARY KEY,
  result_set_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  result_kind TEXT NOT NULL,
  provider_profile_id TEXT NOT NULL,
  profile_service_id TEXT,
  service_card_id TEXT,
  specialty_id TEXT,
  entity_snapshot_id TEXT,
  placement TEXT NOT NULL DEFAULT 'organic',
  match_reason TEXT,
  UNIQUE (result_set_id, position),
  FOREIGN KEY (result_set_id) REFERENCES analytics_result_sets(result_set_id)
) STRICT;

CREATE TABLE analytics_entity_snapshots (
  snapshot_id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  attributes_json TEXT NOT NULL CHECK (json_valid(attributes_json)),
  UNIQUE (entity_type, entity_id, snapshot_id)
) STRICT;

CREATE TABLE analytics_archive_manifests (
  manifest_id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  cutoff_received_at TEXT NOT NULL,
  event_count INTEGER NOT NULL,
  checksum TEXT NOT NULL,
  schema_version INTEGER NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  verified_at TEXT
) STRICT;

CREATE TABLE analytics_job_runs (
  run_id TEXT PRIMARY KEY,
  job_name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL,
  cursor_value TEXT,
  detail_code TEXT
) STRICT;

CREATE TABLE analytics_daily_query_terms (
  day TEXT NOT NULL,
  query_normalized TEXT NOT NULL,
  query_sanitized TEXT NOT NULL,
  search_count INTEGER NOT NULL,
  session_count INTEGER NOT NULL,
  zero_result_count INTEGER NOT NULL,
  projection_version INTEGER NOT NULL,
  calculated_at TEXT NOT NULL,
  PRIMARY KEY (day, query_normalized, projection_version)
) STRICT;

CREATE TABLE analytics_deletion_requests (
  request_id TEXT PRIMARY KEY,
  session_id TEXT,
  requested_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL
) STRICT;

CREATE INDEX analytics_events_received_idx ON analytics_events(received_at);
CREATE INDEX analytics_events_session_idx ON analytics_events(session_id, page_view_id, client_sequence);
CREATE INDEX analytics_events_profile_idx ON analytics_events(provider_profile_id, occurred_at);
CREATE INDEX analytics_events_service_idx ON analytics_events(profile_service_id, occurred_at);
CREATE INDEX analytics_events_card_idx ON analytics_events(service_card_id, occurred_at);
CREATE INDEX analytics_events_search_idx ON analytics_events(search_id);
CREATE INDEX analytics_events_list_idx ON analytics_events(list_view_id, result_item_id);
CREATE INDEX analytics_queries_expiry_idx ON analytics_search_queries(expires_at);
CREATE INDEX analytics_segments_received_idx ON analytics_segments(received_at);
