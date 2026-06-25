/**
 * Hierarchical project dashboard types.
 *
 * The dashboard drills down: project card grid → charter skeleton (capabilities)
 * → changes under a capability → the existing 5 views.
 *
 * Naming rule (decision korean-display-labels): `key`/`name` fields are the immutable
 * English slug used for linking and routing; `displayName`/`koreanLabel` is the
 * human-facing Korean label only. Never swap them — the key keeps the directory-name
 * link (specs/<key>/) matching byte-for-byte.
 */

/** Static audit status shown on a project card. Not computed live in the tracer bullet. */
export type AuditStatus = 'unknown' | 'clean' | 'warn' | 'fail';

/** One project tile on the landing grid. */
export interface ProjectCard {
  /** Immutable project key (directory name) used for routing. */
  name: string;
  /** Korean display name; falls back to `name` when no label is available. */
  displayName: string;
  /** Whether the project has a charter standing-docs layer (docs/). */
  hasCharter: boolean;
  /** Number of openspec changes found in the project. */
  changeCount: number;
  /** Static audit status badge (not live-computed in the tracer bullet). */
  auditStatus: AuditStatus;
}

/** One capability node in the charter skeleton graph. */
export interface CapabilityNode {
  /** Immutable English capability key (== specs/<key>/ directory name). */
  key: string;
  /** Korean display label (source: spec.md `## capability: key — 한글`, else key-map, else key). */
  koreanLabel: string;
  /** Keys of changes linked to this capability via specs-dir membership. */
  changeKeys: string[];
}

/** A resolved link between a capability and a change (specs-dir exact membership). */
export interface CapabilityChangeLink {
  /** Capability key (left side of the link). */
  capabilityKey: string;
  /** Change key (directory name under openspec/changes/). */
  changeKey: string;
  /**
   * True when the change's specs/<dir> exactly matches a capability key.
   * False entries are surfaced as "미연결" — never silently dropped.
   */
  linked: boolean;
}
