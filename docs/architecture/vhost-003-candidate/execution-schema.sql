-- Per-run state and separate event streams for the disposable indexed fixture.
BEGIN;
SET LOCAL search_path = vhost003_indexed, pg_catalog;

CREATE TABLE execution_run (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    graph_digest bytea NOT NULL,
    graph_key bytea NOT NULL,
    activation_digest bytea NOT NULL,
    activation_key bytea NOT NULL,
    created_at double precision NOT NULL,
    status text COLLATE "C" NOT NULL,
    activation_row bigint NOT NULL,
    next_seq bigint NOT NULL CHECK (next_seq >= 0),
    payload bytea NOT NULL,
    PRIMARY KEY (namespace,id),
    FOREIGN KEY (namespace,activation_row) REFERENCES catalog_activation(namespace,id)
);
CREATE INDEX execution_run_key ON execution_run(namespace,key_digest);
CREATE INDEX execution_run_created ON execution_run(namespace,created_at,id);
CREATE INDEX execution_run_graph ON execution_run(namespace,graph_digest,created_at,id);
CREATE INDEX execution_run_activation ON execution_run(namespace,activation_digest,created_at,id);
CREATE INDEX execution_run_status ON execution_run(namespace,status,created_at,id);
CREATE INDEX execution_run_running ON execution_run(namespace,id) WHERE status='running';

CREATE TABLE execution_event (
    namespace text COLLATE "C" NOT NULL,
    run bigint NOT NULL,
    seq bigint NOT NULL CHECK (seq >= 0),
    payload bytea NOT NULL,
    PRIMARY KEY (namespace,run,seq),
    FOREIGN KEY (namespace,run) REFERENCES execution_run(namespace,id)
);

CREATE TABLE orchestration_run (
    namespace text COLLATE "C" NOT NULL REFERENCES namespaces,
    id bigint GENERATED ALWAYS AS IDENTITY,
    key_digest bytea NOT NULL,
    key_bytes bytea NOT NULL,
    graph_digest bytea NOT NULL,
    graph_key bytea NOT NULL,
    activation_digest bytea NOT NULL,
    activation_key bytea NOT NULL,
    created_at double precision NOT NULL,
    status text COLLATE "C" NOT NULL,
    next_seq bigint NOT NULL CHECK (next_seq >= 0),
    payload bytea NOT NULL,
    PRIMARY KEY (namespace,id)
);
CREATE INDEX orchestration_run_key ON orchestration_run(namespace,key_digest);
CREATE INDEX orchestration_run_created ON orchestration_run(namespace,created_at,id);
CREATE INDEX orchestration_run_graph ON orchestration_run(namespace,graph_digest,created_at,id);
CREATE INDEX orchestration_run_activation ON orchestration_run(namespace,activation_digest,created_at,id);
CREATE INDEX orchestration_run_status ON orchestration_run(namespace,status,created_at,id);
CREATE INDEX orchestration_run_running ON orchestration_run(namespace,id) WHERE status='running';

CREATE TABLE orchestration_event (
    namespace text COLLATE "C" NOT NULL,
    run bigint NOT NULL,
    seq bigint NOT NULL CHECK (seq >= 0),
    payload bytea NOT NULL,
    PRIMARY KEY (namespace,run,seq),
    FOREIGN KEY (namespace,run) REFERENCES orchestration_run(namespace,id)
);

-- A component ordinal preserves each Runtime collection's insertion order.
-- The encoded entry carries its exact Map key and value.
CREATE TABLE orchestration_component (
    namespace text COLLATE "C" NOT NULL,
    run bigint NOT NULL,
    kind text COLLATE "C" NOT NULL,
    ordinal bigint NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace,run,kind,ordinal),
    FOREIGN KEY (namespace,run) REFERENCES orchestration_run(namespace,id)
);

CREATE TABLE orchestration_timer (
    namespace text COLLATE "C" NOT NULL,
    run bigint NOT NULL,
    ordinal bigint NOT NULL,
    timer_key bytea NOT NULL,
    status text COLLATE "C" NOT NULL,
    due_at double precision NOT NULL,
    lease_expires_at double precision,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace,run,ordinal),
    FOREIGN KEY (namespace,run) REFERENCES orchestration_run(namespace,id)
);
CREATE INDEX orchestration_timer_scheduled ON orchestration_timer(namespace,due_at,run,ordinal)
    WHERE status='scheduled';
CREATE INDEX orchestration_timer_expired ON orchestration_timer(namespace,lease_expires_at,run,ordinal)
    WHERE status='firing' AND lease_expires_at IS NOT NULL;

CREATE TABLE orchestration_recoverable (
    namespace text COLLATE "C" NOT NULL,
    run bigint NOT NULL,
    ordinal bigint NOT NULL,
    expires_at double precision NOT NULL,
    payload bytea NOT NULL,
    PRIMARY KEY (namespace,run,ordinal),
    FOREIGN KEY (namespace,run) REFERENCES orchestration_run(namespace,id)
);
CREATE INDEX orchestration_recoverable_expiry ON orchestration_recoverable(namespace,expires_at,run,ordinal);
COMMIT;
