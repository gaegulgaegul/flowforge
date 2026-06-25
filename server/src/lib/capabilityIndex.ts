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
import type { CapabilityChangeLink } from "@flowforge/shared";

/** `## capability: <name>` 추출 (대소문자 무시). audit_match.RE_CAP 동치. */
const RE_CAP = /^##\s+capability:\s*(.+?)\s*$/i;

/**
 * docs/spec.md 본문에서 charter capability 키 집합을 뽑는다.
 * 병기(`키 — 한글`)는 키만 취한다(연결은 영문 슬러그로). trim 외 변형 없음.
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

/**
 * charter capability 집합과 changes 스캔 루트로 역방향 인덱스를 만든다.
 * @param charterCaps  parseCharterCapabilities 결과(charter 측 진실)
 * @param changesRoot  openspec/changes 절대 경로(테스트는 임시 루트 주입)
 */
export function buildCapabilityIndex(
  charterCaps: Set<string>,
  changesRoot: string,
): CapabilityIndex {
  const byCapability = new Map<string, string[]>();
  const links: CapabilityChangeLink[] = [];
  const unlinked: { changeKey: string; capabilityKey: string }[] = [];

  if (!existsSync(changesRoot)) return { byCapability, links, unlinked };

  let names: string[];
  try {
    names = readdirSync(changesRoot).sort();
  } catch {
    return { byCapability, links, unlinked };
  }

  for (const changeKey of names) {
    const changeDir = join(changesRoot, changeKey);
    let st;
    try {
      st = statSync(changeDir);
    } catch {
      continue;
    }
    if (!st.isDirectory() || changeKey === "archive") continue;

    for (const capKey of specDirsOf(changeDir)) {
      // 글자단위 정확 비교 — set 멤버십. 유사도·정규화 추가 금지(거짓연결 0).
      const linked = charterCaps.has(capKey);
      links.push({ capabilityKey: capKey, changeKey, linked });
      if (linked) {
        const arr = byCapability.get(capKey) ?? [];
        arr.push(changeKey);
        byCapability.set(capKey, arr);
      } else {
        unlinked.push({ changeKey, capabilityKey: capKey });
      }
    }
  }

  return { byCapability, links, unlinked };
}
