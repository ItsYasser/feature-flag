-- audit_log is append-only: reject any UPDATE or DELETE at the database level,
-- so even a buggy admin endpoint or a hand-written SQL session can't rewrite history.
CREATE OR REPLACE FUNCTION audit_log_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only (% is not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_reject_mutation();
--> statement-breakpoint
-- flags.key is immutable: services reference flags by key, so renaming one would silently
-- turn every isEnabled() call site into an "unknown flag".
CREATE OR REPLACE FUNCTION flags_reject_key_change() RETURNS trigger AS $$
BEGIN
  IF NEW.key IS DISTINCT FROM OLD.key THEN
    RAISE EXCEPTION 'flags.key is immutable (tried % -> %)', OLD.key, NEW.key;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER flags_key_immutable
  BEFORE UPDATE ON flags
  FOR EACH ROW EXECUTE FUNCTION flags_reject_key_change();
--> statement-breakpoint
INSERT INTO ruleset_version (environment, version) VALUES ('dev', 0), ('staging', 0), ('prod', 0)
  ON CONFLICT (environment) DO NOTHING;
