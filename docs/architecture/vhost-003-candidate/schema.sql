-- VHOST-003 disposable fixture only. Apply once as the test-cluster operator.
BEGIN;
CREATE SCHEMA vhost003_indexed;
REVOKE ALL ON SCHEMA vhost003_indexed FROM PUBLIC;
SET LOCAL search_path = vhost003_indexed, pg_catalog;
CREATE TABLE metadata (
    singleton boolean PRIMARY KEY CHECK (singleton),
    version integer NOT NULL,
    purpose text NOT NULL
);
INSERT INTO metadata VALUES (true, 1, 'VHOST-003 disposable hot-path fixture');
CREATE TABLE namespaces (
    namespace text COLLATE "C" PRIMARY KEY,
    writer_epoch bigint NOT NULL CHECK (writer_epoch > 0)
);
CREATE TABLE callback_admission (
    namespace text COLLATE "C" PRIMARY KEY REFERENCES namespaces
);
CREATE TABLE actors (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    actor_key bytea NOT NULL,
    status text NOT NULL CHECK (status IN ('active', 'disabled')),
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, actor_key)
);
CREATE TABLE turn_head (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_prefix bytea NOT NULL,
    key_bytes bytea NOT NULL,
    payload bytea,
    is_open boolean,
    PRIMARY KEY (namespace, id),
    CHECK ((payload IS NULL) = (is_open IS NULL))
);
CREATE INDEX turn_identity ON turn_head(namespace, key_digest);
CREATE INDEX turn_listing ON turn_head(namespace, key_prefix) WHERE payload IS NOT NULL;
CREATE INDEX turn_open_listing ON turn_head(namespace, key_prefix) WHERE is_open;
CREATE TABLE cancel_intents (
    namespace text COLLATE "C" NOT NULL,
    turn bigint NOT NULL,
    ordinal bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, turn, ordinal),
    FOREIGN KEY (namespace, turn) REFERENCES turn_head
);
CREATE INDEX cancel_identity ON cancel_intents(namespace, turn, key_digest);
CREATE TABLE stream_clock (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    stream_key bytea NOT NULL,
    seq bigint NOT NULL CHECK (seq >= 0),
    PRIMARY KEY (namespace, stream_key)
);
CREATE TABLE stream_events (
    namespace text COLLATE "C" NOT NULL,
    stream_key bytea NOT NULL,
    seq bigint NOT NULL CHECK (seq > 0),
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, stream_key, seq),
    FOREIGN KEY (namespace, stream_key) REFERENCES stream_clock
);
-- Source-compatible columns for the exact packed coordination implementation.
CREATE TABLE coordination (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    scope_id text COLLATE "C" NOT NULL,
    actor_id text COLLATE "C" NOT NULL,
    owner_id text COLLATE "C",
    fence bigint NOT NULL DEFAULT 0,
    expires_at timestamptz,
    purpose text NOT NULL CHECK (purpose IN ('work', 'deletion')),
    deleted boolean NOT NULL DEFAULT false,
    PRIMARY KEY (namespace, scope_id)
);
CREATE TABLE effects (
    namespace text COLLATE "C" NOT NULL,
    scope_id text COLLATE "C" NOT NULL,
    effect_id text COLLATE "C" NOT NULL,
    argument_digest text COLLATE "C" NOT NULL,
    status text NOT NULL CHECK (status IN ('uncertain', 'applied', 'not-applied')),
    fence bigint NOT NULL,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (namespace, scope_id, effect_id),
    FOREIGN KEY (namespace, scope_id) REFERENCES coordination
);
-- Fixture-only rehearsal. An operator must hold the exclusive epoch lock;
-- the trigger executes in that transaction and retains leases' lineage,
-- tombstones and receipts while retiring their previous owner generation.
CREATE FUNCTION retire_epoch_leases() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog AS $body$
BEGIN
    IF NEW.writer_epoch <> OLD.writer_epoch + 1 THEN
        RAISE EXCEPTION 'Writer epoch must advance by one';
    END IF;
    UPDATE vhost003_indexed.coordination
       SET owner_id = NULL, expires_at = NULL, fence = fence + 1
     WHERE namespace = OLD.namespace AND owner_id IS NOT NULL;
    RETURN NEW;
END;
$body$;
CREATE TRIGGER retire_epoch_leases BEFORE UPDATE OF writer_epoch ON namespaces
FOR EACH ROW EXECUTE FUNCTION retire_epoch_leases();
COMMIT;
