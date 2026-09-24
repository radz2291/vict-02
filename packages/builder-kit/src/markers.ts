/**
 * Versioned schema markers of the Vict Builder Kit protocol.
 * Every generated or validated document carries exactly one of these.
 */
export const CONTEXT_PACK_SCHEMA = 'vict.builder.context-pack@1';
/** App-local base pack of an external application project (handoff WP-1 `init-app`). */
export const APP_PACK_SCHEMA = 'vict.builder.app-pack@1';
export const TASK_PACK_SCHEMA = 'vict.builder.task-pack@1';
export const CATALOG_SCHEMA = 'vict.builder.catalog@1';
export const TOOLS_SCHEMA = 'vict.builder.tools@1';
export const PROFILE_SCHEMA = 'vict.builder.profile@1';
export const HANDOFF_SCHEMA = 'vict.builder.handoff@1';
export const RESULT_SCHEMA = 'vict.builder.result@1';
export const AUDIT_SCHEMA = 'vict.builder.audit@1';
/** Bootstrap protocol identity carried by every generated BUILDER-KIT.md. */
export const BOOTSTRAP_PROTOCOL = 'vict.builder.bootstrap@1';

export const ALL_SCHEMA_MARKERS: readonly string[] = [
  CONTEXT_PACK_SCHEMA,
  APP_PACK_SCHEMA,
  TASK_PACK_SCHEMA,
  CATALOG_SCHEMA,
  TOOLS_SCHEMA,
  PROFILE_SCHEMA,
  HANDOFF_SCHEMA,
  RESULT_SCHEMA,
  AUDIT_SCHEMA,
];
