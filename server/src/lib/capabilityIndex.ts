/**
 * capabilityIndex — charter 뼈대(capability)와 change(specs/<dir>)를 연결하는 역방향 인덱스.
 *
 * 연결 규칙(decision specs-dir-link): change 측 `specs/<디렉토리명>/`과 charter 측
 * `docs/spec.md`의 `## capability: <키>`를 **글자단위 정확 비교**(trim만, 유사도 X)로
 * 연결한다. 거짓연결 0이 성공 기준 — 매칭 안 되는 change/capability는 silent drop이
 * 아니라 "미연결(unlinked)"로 표면화한다.
 *
 * charter `## capability:` 파싱은 audit_match.py RE_CAP 동치(읽기전용). 키 변형 금지.
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { splitCapabilityLabel } from "./koreanLabels.js";
import type { CapabilityChangeLink, FeatureTree } from "@flowforge/shared";

/** `## capability: <name>` 추출 (대소문자 무시). audit_match.RE_CAP 동치. */
const RE_CAP = /^##\s+capability:\s*(.+?)\s*$/i;

/**
 * features.md 요구사항 capability 마커 `<!-- capability: KEY -->` 추출.
 * featureTreeBuilder의 RE_CAPABILITY와 **동일 정규식**(글자단위, 키 변형 없음).
 * charter의 `## capability:` 헤더 문법과 네임스페이스가 분리돼 오매칭하지 않는다.
 */
const RE_FEATURE_CAP = /<!--\s*capability:\s*([A-Za-z0-9_-]+)\s*-->/;

/**
 * docs/spec.md 본문에서 charter capability 키 집합을 뽑는다.
 * 병기(`키 — 한글`)는 키만 취한다(연결은 영문 슬러그로). trim 외 변형 없음.
 *
 * ⚠️ charter(docs/spec.md)는 폐기 방향(backbone 안2, 2026-07-02). node-mapping 배지 조인은
 * `parseFeatureCapabilities`(features.md)로 전환됐다(mapping-basis-shift D1). 이 함수는 여전히
 * projects.ts의 capability 카드 대시보드가 소비하므로 유지한다.
 */
export function parseCharterCapabilities(specMd: string): Set<string> {
  const out = new Set<string>();
  for (const raw of specMd.split(/\r?\n/)) {
    const m = RE_CAP.exec(raw);
    if (!m || !m[1]) continue;
    const { key } = splitCapabilityLabel(m[1]);
    if (key) out.add(key);
  }
  return out;
}

/**
 * docs/planning/features.md 본문에서 요구사항 capability 키 집합을 뽑는다(mapping-basis-shift D1).
 * `<!-- capability: KEY -->` 마커만 본다(charter `## capability:` 헤더 문법과 분리). featureTreeBuilder
 * RE_CAPABILITY 동형이라 노드 좌변(attachLinkedChanges)과 조인 필터가 **동일 원천**으로 정합한다.
 * 파일 부재/빈 입력이면 빈 Set → 배지 0(비파괴 폴백).
 */
export function parseFeatureCapabilities(featuresMd: string): Set<string> {
  const out = new Set<string>();
  for (const raw of featuresMd.split(/\r?\n/)) {
    const m = RE_FEATURE_CAP.exec(raw);
    if (m && m[1]) out.add(m[1]);
  }
  return out;
}

/** change 측 `specs/` 하위 디렉토리명(= 선언한 capability 키) 목록. */
function specDirsOf(changeDir: string): string[] {
  const specsRoot = join(changeDir, "specs");
  if (!existsSync(specsRoot)) return [];
  const out: string[] = [];
  try {
    for (const name of readdirSync(specsRoot).sort()) {
      const d = join(specsRoot, name);
      if (existsSync(join(d, "spec.md"))) out.push(name);
    }
  } catch {
    return [];
  }
  return out;
}

/** capability 인덱스 결과. */
export interface CapabilityIndex {
  /** capabilityKey → 연결된 change 키 목록 (글자단위 일치만). */
  byCapability: Map<string, string[]>;
  /** 모든 (capability, change) 연결 판정 — linked=false 포함(거짓연결 0의 증거). */
  links: CapabilityChangeLink[];
  /** charter capability에 매칭 안 된 change 측 선언 — 명시 표시용(누락 금지). */
  unlinked: { changeKey: string; capabilityKey: string }[];
}

/** 디렉토리인지 안전 판정(stat 실패=false). */
function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** changesRoot 하위의 디렉토리명 목록(정렬). 읽기 실패=빈 배열(안전 폴백). */
function dirNamesOf(root: string): string[] {
  try {
    return readdirSync(root).sort();
  } catch {
    return [];
  }
}

/**
 * charter/features capability 집합과 changes 스캔 루트로 역방향 인덱스를 만든다.
 *
 * `allowedCaps`는 조인 필터(허용 capability 집합) — **원천에 무관**(charter든 features.md든).
 * 이 시그니처·의미는 mapping-basis-shift 전후 불변이라 projects.ts(charter 카드) 소비가 무손상이다.
 * node-mapping 배지 경로(docs.ts)만 주입 집합을 features.md로 바꾼다(D1).
 *
 * archive 완화(D2): `openspec/changes/archive/<dated-change>/`(1단계)도 change로 스캔에 포함한다.
 * 활성 전용이던 것을 완화 — 완료돼 archive된 change의 capability도 배지로 표시(archived=true 표기).
 *
 * @param allowedCaps  조인 필터 집합(charter=projects.ts / features.md=docs.ts node-mapping)
 * @param changesRoot  openspec/changes 절대 경로(테스트는 임시 루트 주입)
 */
export function buildCapabilityIndex(
  allowedCaps: Set<string>,
  changesRoot: string,
): CapabilityIndex {
  const byCapability = new Map<string, string[]>();
  const links: CapabilityChangeLink[] = [];
  const unlinked: { changeKey: string; capabilityKey: string }[] = [];

  if (!existsSync(changesRoot)) return { byCapability, links, unlinked };

  /** 한 change 디렉토리를 처리해 링크/인덱스/미연결을 채운다(활성·archive 공통). */
  const processChange = (changeDir: string, changeKey: string, archived: boolean): void => {
    for (const capKey of specDirsOf(changeDir)) {
      // 글자단위 정확 비교 — set 멤버십. 유사도·정규화 추가 금지(거짓연결 0).
      const linked = allowedCaps.has(capKey);
      // archived는 archive 하위일 때만 실어 활성 링크 형태를 바꾸지 않는다(옵셔널·비파괴).
      links.push({ capabilityKey: capKey, changeKey, linked, ...(archived ? { archived: true } : {}) });
      if (linked) {
        const arr = byCapability.get(capKey) ?? [];
        arr.push(changeKey);
        byCapability.set(capKey, arr);
      } else {
        unlinked.push({ changeKey, capabilityKey: capKey });
      }
    }
  };

  for (const changeKey of dirNamesOf(changesRoot)) {
    const changeDir = join(changesRoot, changeKey);
    if (!isDir(changeDir)) continue;
    if (changeKey === "archive") {
      // archive/ 아래는 dated change 래퍼 — 한 단계 더 내려가 각각을 change로 처리(D2).
      for (const dated of dirNamesOf(changeDir)) {
        const datedDir = join(changeDir, dated);
        if (isDir(datedDir)) processChange(datedDir, dated, true);
      }
      continue;
    }
    processChange(changeDir, changeKey, false);
  }

  return { byCapability, links, unlinked };
}

/** 한 user-flow stem이 선언한 capability 키들(`> capability: <키>` 마커 스캔 결과). */
export interface UserFlowCaps {
  stem: string;
  caps: string[];
}

/** capability 단위 종합 집계 결과(데이터만 — koreanLabel/displayName 합성은 라우트). */
export interface CapabilityDetailData {
  /** capability 키와 일치하는 요구사항 가지만 남긴 features 트리. 원본이 null이면 null. */
  features: FeatureTree | null;
  /** `> capability: <키>`로 그 capability를 선언한 user-flow stem 목록. */
  userFlows: string[];
  /** 그 capability를 건드리는 change 키 목록(byCapability 그대로). */
  changes: string[];
}

/**
 * capability 키 하나에 대해 features 서브트리 + 연결 유저플로우 + change 목록을 집계한다.
 * 순수 함수 — 파일 IO 없음(라우트가 featureTree·userFlowCaps를 읽어 주입). 연결은 전부
 * **글자단위 정확 비교**(유사도 금지, 거짓연결 0). 연결 0개여도 throw 없이 빈 구조를 돌려준다.
 *
 * @param cap           대상 capability 영문 키(불변)
 * @param index         buildCapabilityIndex 결과(byCapability 재사용 — 재구현 없음)
 * @param featureTree   buildDocsPlanningFeatures 결과(없으면 null)
 * @param userFlowCaps  각 user-flow stem이 선언한 capability 키들
 */
export function buildCapabilityDetail(
  cap: string,
  index: CapabilityIndex,
  featureTree: FeatureTree | null,
  userFlowCaps: UserFlowCaps[],
): CapabilityDetailData {
  // features: 가상 루트 아래 요구사항 중 capability가 정확히 일치하는 가지만(하위 보존).
  const features: FeatureTree | null = featureTree
    ? { root: { ...featureTree.root, children: featureTree.root.children.filter((r) => r.capability === cap) } }
    : null;

  // userFlows: 마커로 그 capability를 선언한 stem만(글자단위 일치).
  const userFlows = userFlowCaps.filter((f) => f.caps.includes(cap)).map((f) => f.stem);

  // changes: 역방향 인덱스 그대로.
  const changes = index.byCapability.get(cap) ?? [];

  return { features, userFlows, changes };
}

/**
 * 기능명세 트리의 **요구사항 노드**에만 연관 change 키 목록(linkedChanges)을 부여한 새 트리를 돌려준다
 * (flowforge-change-node-mapping). node.capability로 byCapability를 조회한 결과이며, 연관 change가
 * 0개거나 capability가 빈 문자열이면 필드를 붙이지 않는다(비파괴 옵셔널). 기능/상세기능 노드는 자체
 * capability가 없으므로 여기서 부여하지 않는다 — 상속·역경유는 web adapter가 이 값을 기점으로 파생한다.
 *
 * 순수 함수 — 파일 IO 없음. byCapability 재사용(재구현·유사도 매칭 없음, 글자단위 일치). null 트리는 null.
 *
 * @param tree   buildDocsPlanningFeatures 결과(없으면 null)
 * @param index  buildCapabilityIndex 결과(byCapability 재사용)
 */
export function attachLinkedChanges(
  tree: FeatureTree | null,
  index: CapabilityIndex,
): FeatureTree | null {
  if (!tree) return null;
  const withLinks = (node: FeatureTree["root"]): FeatureTree["root"] => {
    const children = node.children.map(withLinks);
    // 요구사항 노드 + capability 있을 때만 조회. 연관 change 0개면 필드 미부착(비파괴).
    if (node.kind === "requirement" && node.capability) {
      const changes = index.byCapability.get(node.capability) ?? [];
      if (changes.length > 0) return { ...node, linkedChanges: changes, children };
    }
    return { ...node, children };
  };
  return { root: withLinks(tree.root) };
}
