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

import type { FeatureTree } from './feature-tree-types.js';

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
  /** Number of active (non-archived) openspec changes. */
  changeCount: number;
  /** Static audit status badge (not live-computed in the tracer bullet). */
  auditStatus: AuditStatus;
  /** Number of archived changes (additive). */
  archivedChangeCount?: number;
  /** Active change display names, up to 2 (additive). */
  activeChangeNames?: string[];
  /** Most recent activity date, KST (Asia/Seoul) YYYY-MM-DD. additive. */
  lastActivityAt?: string;
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
  /**
   * True when the change lives under openspec/changes/archive/ (완료·아카이브).
   * Additive/optional — 기존 소비자는 무시. 후속 change가 활성/archive 시각 구분에 쓸 수 있게
   * 데이터만 실어둔다(node-mapping 배지 UI는 이 change에서 불변).
   */
  archived?: boolean;
}

/** One change row in a capability detail (English key + Korean display name). */
export interface CapabilityChangeRef {
  /** Immutable change directory name (routing key). */
  key: string;
  /** Korean display title (proposal H1), falls back to key. */
  displayName: string;
  /**
   * Project this change belongs to (PROJECTS_ROOT sub-name). Additive — the web
   * carries it into the 5 view fetches + layout save so a change drilled from a
   * project card resolves under that project's openspec/changes (not the global root).
   */
  project?: string;
}

/**
 * Aggregated detail for a single capability — co-locates the planning context
 * (features subtree + linked user-flow stems) with the changes touching it.
 *
 * Linking rule unchanged: capability key matched byte-for-byte (no fuzzy match,
 * zero false links). Empty sections are surfaced explicitly, never hidden.
 */
export interface CapabilityDetail {
  /** Immutable English capability key (== specs/<key>/ directory name). */
  key: string;
  /** Korean display label (spec.md `## capability: key — 한글`, else key). */
  koreanLabel: string;
  /**
   * Features subtree: a synthetic root whose children are the requirement
   * nodes whose `capability` field equals `key` (with their descendants).
   * null when docs/planning/features.md is absent.
   */
  features: FeatureTree | null;
  /** Stems of user-flow specs that declare `> capability: <key>`. */
  userFlows: string[];
  /** Changes whose specs/<key>/ matches this capability (reverse index). */
  changes: CapabilityChangeRef[];
}
