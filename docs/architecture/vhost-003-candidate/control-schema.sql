-- VHOST-007 fixture. A version mismatch prevents opening an earlier layout.
BEGIN;
SET LOCAL search_path = vhost003_indexed, pg_catalog;

-- All lookup indexes use digests of complete UTF-16 code units. Predicates
-- also compare full key bytes. Prefixes bound B-tree slots for lexical order.
CREATE TABLE control_changeset (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    key_prefix bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX control_changeset_key ON control_changeset(namespace, key_digest);
CREATE INDEX control_changeset_order1 ON control_changeset(namespace, key_prefix);

CREATE TABLE control_approval (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    subject_digest bytea NOT NULL,
    subject_key bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX control_approval_key ON control_approval(namespace, key_digest);
CREATE INDEX control_approval_order1 ON control_approval(namespace, subject_digest,id);

CREATE TABLE control_run (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX control_run_key ON control_run(namespace, key_digest);

CREATE TABLE control_operation (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    subject_digest bytea NOT NULL,
    subject_key bytea NOT NULL,
    operation_index double precision NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX control_operation_key ON control_operation(namespace, key_digest);
CREATE INDEX control_operation_order1 ON control_operation(namespace, subject_digest,operation_index,id);

CREATE TABLE control_release (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    subject_digest bytea NOT NULL,
    subject_key bytea NOT NULL,
    key_prefix bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX control_release_key ON control_release(namespace, key_digest);
CREATE INDEX control_release_order1 ON control_release(namespace, subject_digest,key_prefix);

CREATE TABLE control_selection (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    subject_digest bytea NOT NULL,
    subject_key bytea NOT NULL,
    revision bigint NOT NULL,
    target bigint NOT NULL,
    target_key bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id),
    FOREIGN KEY (namespace, target) REFERENCES control_release(namespace, id)
);
CREATE INDEX control_selection_key ON control_selection(namespace, key_digest);
CREATE INDEX control_selection_order1 ON control_selection(namespace, subject_digest,revision DESC);

CREATE TABLE control_audit (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    subject_digest bytea NOT NULL,
    subject_key bytea NOT NULL,
    kind_digest bytea NOT NULL,
    kind_key bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX control_audit_key ON control_audit(namespace, key_digest);
CREATE INDEX control_audit_order1 ON control_audit(namespace, subject_digest,id);
CREATE INDEX control_audit_order2 ON control_audit(namespace, kind_digest,id);

CREATE TABLE catalog_activation (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX catalog_activation_key ON catalog_activation(namespace, key_digest);

CREATE TABLE catalog_selection (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    target bigint NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id),
    FOREIGN KEY (namespace, target) REFERENCES catalog_activation(namespace, id)
);
CREATE INDEX catalog_selection_key ON catalog_selection(namespace, key_digest);

CREATE TABLE governance_activation (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX governance_activation_key ON governance_activation(namespace, key_digest);

CREATE TABLE governance_intent (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    key_prefix bytea NOT NULL,
    open boolean NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, id)
);
CREATE INDEX governance_intent_key ON governance_intent(namespace, key_digest);
CREATE INDEX governance_intent_order1 ON governance_intent(namespace, key_prefix);
CREATE INDEX governance_intent_order2 ON governance_intent(namespace, key_prefix) WHERE open;

CREATE TABLE governance_receipt (
    namespace text COLLATE "C" NOT NULL,
    intent bigint NOT NULL,
    step text COLLATE "C" NOT NULL CHECK (step IN ('application-domain', 'memory-store')),
    payload bytea NOT NULL,
    PRIMARY KEY (namespace, intent, step),
    FOREIGN KEY (namespace, intent) REFERENCES governance_intent(namespace, id)
);

UPDATE metadata SET version=4, purpose='VHOST-007 disposable indexed governance fixture'
WHERE singleton AND version=3 AND purpose='VHOST-004 disposable command fence repair fixture';
COMMIT;
