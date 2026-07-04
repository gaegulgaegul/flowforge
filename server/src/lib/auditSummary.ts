// docs/audit.json items[]의 capability 단위 집계 (design D-1·D-3)
// 신뢰 경계: 이미 검증된 projectDir 기준으로만 경로 구성, audit.json 내부 경로(scanRoot 등) 불신.
// 소비 필드는 items[].{capability, verdict, claim, reason}만. 실패는 전부 빈 맵 폴백(throw 금지).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CapabilityAuditFailClaim, CapabilityAuditSummary } from "@flowforge/shared";

interface MutableSummary {
  pass: number;
  fail: number;
  unverifiable: number;
  failClaims: CapabilityAuditFailClaim[];
}

/** items[]를 capability 키로 집계한다. 비배열·이상 item은 안전하게 무시(순수 함수). */
export function aggregateAuditItems(items: unknown): Record<string, CapabilityAuditSummary> {
  if (!Array.isArray(items)) return {};
  const acc = new Map<string, MutableSummary>();
  for (const raw of items) {
    if (typeof raw !== "object" || raw === null) continue;
    const it = raw as Record<string, unknown>;
    const capability = it.capability;
    const verdict = it.verdict;
    if (typeof capability !== "string" || capability === "" || typeof verdict !== "string") continue;
    let entry = acc.get(capability);
    if (!entry) {
      entry = { pass: 0, fail: 0, unverifiable: 0, failClaims: [] };
      acc.set(capability, entry);
    }
    if (verdict === "PASS") entry.pass += 1;
    else if (verdict === "FAIL") {
      entry.fail += 1;
      entry.failClaims.push({
        claim: typeof it.claim === "string" ? it.claim : "",
        reason: typeof it.reason === "string" ? it.reason : "",
      });
    } else if (verdict === "UNVERIFIABLE") entry.unverifiable += 1;
    // 그 외 verdict 값은 스키마 드리프트로 간주하고 어떤 건수에도 세지 않는다
  }
  const result: Record<string, CapabilityAuditSummary> = {};
  for (const [capability, e] of acc) {
    const status = e.fail >= 1 ? "fail" : e.pass >= 1 ? "clean" : "unknown";
    result[capability] = { status, ...e };
  }
  return result;
}

/** <projectDir>/docs/audit.json을 읽어 capability 집계 맵 반환. 파일 없음·깨진 JSON은 빈 맵. */
export function readAuditCapabilities(projectDir: string): Record<string, CapabilityAuditSummary> {
  try {
    const parsed: unknown = JSON.parse(readFileSync(join(projectDir, "docs", "audit.json"), "utf8"));
    if (typeof parsed !== "object" || parsed === null) return {};
    return aggregateAuditItems((parsed as { items?: unknown }).items);
  } catch {
    return {};
  }
}
