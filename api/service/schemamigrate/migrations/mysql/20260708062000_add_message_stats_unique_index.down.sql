SET @idx_exists := (
    SELECT COUNT(1)
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
      AND table_name = 'message_stats'
      AND index_name = 'idx_message_stats_eid_agent_date'
);

SET @sql_stmt := IF(
    @idx_exists > 0,
    'ALTER TABLE message_stats DROP INDEX idx_message_stats_eid_agent_date, ALGORITHM=INPLACE, LOCK=NONE',
    'SELECT 1'
);

PREPARE stmt FROM @sql_stmt;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
