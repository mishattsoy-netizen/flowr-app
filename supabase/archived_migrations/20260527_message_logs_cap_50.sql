-- Keep only the latest 50 message_logs rows.
-- A trigger runs after each insert and deletes anything beyond the most recent 50.

CREATE OR REPLACE FUNCTION trim_message_logs() RETURNS trigger AS $$
BEGIN
  DELETE FROM message_logs
  WHERE id IN (
    SELECT id FROM message_logs
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS message_logs_trim_trigger ON message_logs;
CREATE TRIGGER message_logs_trim_trigger
  AFTER INSERT ON message_logs
  FOR EACH STATEMENT
  EXECUTE FUNCTION trim_message_logs();

-- One-time cleanup of existing rows beyond 50
DELETE FROM message_logs
WHERE id IN (
  SELECT id FROM message_logs
  ORDER BY created_at DESC
  OFFSET 50
);
