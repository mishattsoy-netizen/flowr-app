-- Migration: 20260701_secure_quota_rpc.sql
-- Description: Create a secure RPC function to check and increment user quotas.

CREATE OR REPLACE FUNCTION increment_my_quota()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER -- runs with admin privileges
AS $$
DECLARE
  v_user_id UUID;
  v_today TEXT;
  v_current_count INTEGER;
  v_last_reset TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;
  
  v_today := TO_CHAR(NOW(), 'YYYY-MM-DD');
  
  -- Get current count or insert
  SELECT messages_used_today, last_reset_date INTO v_current_count, v_last_reset
  FROM user_quotas
  WHERE auth_user_id = v_user_id;
  
  IF NOT FOUND THEN
    INSERT INTO user_quotas (auth_user_id, messages_used_today, last_reset_date)
    VALUES (v_user_id, 1, v_today);
    RETURN TRUE;
  END IF;
  
  -- Reset daily limit if day has changed
  IF v_last_reset < v_today THEN
    UPDATE user_quotas
    SET messages_used_today = 1,
        last_reset_date = v_today
    WHERE auth_user_id = v_user_id;
    RETURN TRUE;
  END IF;
  
  -- Check limits (e.g. 1000 limit)
  IF v_current_count >= 1000 THEN
    RETURN FALSE;
  END IF;
  
  UPDATE user_quotas
  SET messages_used_today = v_current_count + 1,
      last_reset_date = v_today
  WHERE auth_user_id = v_user_id;
  
  RETURN TRUE;
END;
$$;
