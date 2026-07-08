CREATE UNIQUE INDEX IF NOT EXISTS idx_message_stats_eid_agent_date
ON message_stats (eid, agent_id, stat_date);
