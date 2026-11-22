-- VHOST-004 test-only extension, applied before a namespace is provisioned.
BEGIN;
SET LOCAL search_path = vhost003_indexed, pg_catalog;

-- Complete byte identity is checked inside every digest bucket. Keys can
-- exceed PostgreSQL's B-tree item limit. Mutations lock the exact bucket
-- before selecting or inserting. No uniqueness claim rests on a digest.
CREATE TABLE tool_slot_head (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    last_slot double precision NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX tool_slot_head_key ON tool_slot_head(namespace, key_digest);
CREATE TABLE tool_slot (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX tool_slot_key ON tool_slot(namespace, key_digest);

CREATE TABLE tool_invocation (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    key_prefix bytea NOT NULL,
    request_digest bytea NOT NULL,
    request_key bytea NOT NULL,
    turn_digest bytea NOT NULL,
    turn_key bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX tool_invocation_key ON tool_invocation(namespace, key_digest);
CREATE INDEX tool_invocation_request ON tool_invocation(namespace, request_digest);
CREATE INDEX tool_invocation_turn ON tool_invocation(namespace, turn_digest, key_prefix);

CREATE TABLE agent_approval (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    key_prefix bytea NOT NULL,
    invocation_digest bytea NOT NULL,
    invocation_key bytea NOT NULL,
    pending boolean NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX agent_approval_key ON agent_approval(namespace, key_digest);
CREATE INDEX agent_approval_current ON agent_approval(namespace, invocation_digest, id DESC);
CREATE INDEX agent_approval_pending ON agent_approval(namespace, key_prefix) WHERE pending;

CREATE TABLE command_receipt (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    actor_request_digest bytea NOT NULL,
    actor_request_key bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX command_receipt_key ON command_receipt(namespace, key_digest);
CREATE INDEX command_receipt_actor_request ON command_receipt(namespace, actor_request_digest, id);

-- Append-only claim history survives release, settlement and writer epoch
-- changes. Digests enforce namespace-wide token non-reuse. A digest
-- collision is rejected, never accepted as a new fence.
CREATE TABLE command_claim_fence (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    fence_digest bytea NOT NULL,
    PRIMARY KEY (namespace, fence_digest),
    CHECK (octet_length(fence_digest) = 32)
);

CREATE TABLE confirmation_receipt (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    key_prefix bytea NOT NULL,
    prepare_digest bytea NOT NULL,
    prepare_key bytea NOT NULL,
    actor_command_digest bytea NOT NULL,
    actor_command_key bytea NOT NULL,
    replacement_no double precision NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX confirmation_receipt_key ON confirmation_receipt(namespace, key_digest);
CREATE INDEX confirmation_receipt_prepare
    ON confirmation_receipt(namespace, prepare_digest, replacement_no, key_prefix);
CREATE INDEX confirmation_receipt_actor_command
    ON confirmation_receipt(namespace, actor_command_digest, replacement_no, key_prefix);

UPDATE metadata SET version=3, purpose='VHOST-004 disposable command fence repair fixture'
 WHERE singleton AND version=1 AND purpose='VHOST-003 disposable hot-path fixture';
COMMIT;
