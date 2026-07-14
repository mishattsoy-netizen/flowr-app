-- Migration: 20260707_drop_legacy_quota.sql
-- Description: Removes the flat daily-message-count quota, superseded by
-- cost-based credit_spend_events metering.
DROP FUNCTION IF EXISTS increment_my_quota();
DROP TABLE IF EXISTS user_quotas;
