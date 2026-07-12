/**
 * auditTrigger — flowforge = 얇은 인증 프록시.
 *
 * "감사 진행" 버튼(POST /api/docs/:project/audit-run)이 이 모듈을 호출한다.
 * flowforge 컨테이너는 audit을 직접 실행하지 않는다(홈 RO 마운트·python3/git 부재).
 * 대신 호스트의 openspec-reports 큐(127.0.0.1:8810/api/tasks)에 `{project, change:"-",
 * action:"audit"}` 잡을 enqueue만 한다. 실제 실행은 systemd 워커(샌드박스)가 담당.
 *
 * 보안 경계(design RCE 체크리스트):
 *  - project 키 화이트리스트(`^[A-Za-z0-9_-]+$`) + resolveProjectDir 재검증 → '..'·절대경로 차단.
 *  - 큐 호출은 loopback(127.0.0.1)로만. 서비스 토큰(OPENSPEC_CONSOLE_TOKEN) Bearer.
 *    이 토큰은 사용자 토큰과 분리(escalation 차단) — 미설정이면 워커측이 401로 거부.
 *  - shell 미경유(fetch JSON). project는 문자열 필드로만 전달, 경로/명령으로 직접 안 씀.
 *  - 중복 enqueue 디바운스(버튼 연타 큐 폭주 방지) — 동일 project 최근 enqueue를 짧게 억제.
 */
import { resolveProjectDir } from "./projects.js";

/** openspec-reports 큐 엔드포인트. loopback 고정(외부 노출 금지). env로 테스트 override. */
function queueUrl(): string {
  return (process.env.OPENSPEC_QUEUE_URL ?? "http://127.0.0.1:8810/api/tasks").trim();
}

/** 워커 큐 서비스 토큰(사용자 토큰과 분리). 미설정이면 빈 문자열(워커가 401로 거부). */
function consoleToken(): string {
  return (process.env.OPENSPEC_CONSOLE_TOKEN ?? "").trim();
}

/** project 키 화이트리스트(routes·projects.ts와 동일 기준). '..'·경로구분자 차단. */
const PROJECT_KEY_RE = /^[A-Za-z0-9_-]+$/;

/** enqueue 결과. ok=false면 status로 라우트가 4xx/5xx 매핑. */
export interface AuditTriggerResult {
  ok: boolean;
  /** 실패 분류(라우트 응답 매핑용). */
  status?: "invalid_project" | "unauthorized" | "debounced" | "queue_error";
  /** 성공 시 워커가 부여한 task_id(있으면). */
  taskId?: number;
}

/** 디바운스 창(ms). 동일 project를 이 창 안에 다시 트리거하면 억제(연타 방지). */
const DEBOUNCE_MS = 5_000;

/** project → 마지막 enqueue 시각(ms). 프로세스 로컬(단일 워커 프론트라 충분). */
const lastEnqueueAt = new Map<string, number>();

/** 테스트 훅: 디바운스 맵 초기화. */
export function _resetAuditDebounce(): void {
  lastEnqueueAt.clear();
}

/**
 * 그 project의 openspec-audit 잡을 openspec-reports 큐에 enqueue한다.
 * 화이트리스트·resolveProjectDir 통과분만 큐로 보낸다. audit은 프로젝트 단위라 change="-".
 * 네트워크·워커 오류는 throw하지 않고 ok:false로 표면화(라우트가 502로 매핑).
 */
export async function triggerAudit(project: string): Promise<AuditTriggerResult> {
  // 1) 화이트리스트 + 실재 프로젝트 재검증(경로조작·미등록 차단). resolveProjectDir가 심링크·부재도 거른다.
  if (!PROJECT_KEY_RE.test(project) || resolveProjectDir(project) === null) {
    return { ok: false, status: "invalid_project" };
  }

  // 2) 서비스 토큰 필수(미설정이면 워커가 어차피 401 — 큐 호출 전에 조기 차단해 공개 트리거 방지).
  const token = consoleToken();
  if (token.length === 0) {
    return { ok: false, status: "unauthorized" };
  }

  // 3) 중복 enqueue 디바운스(연타 방지). 창 안 재요청은 큐로 안 보내고 debounced.
  const now = Date.now();
  const prev = lastEnqueueAt.get(project);
  if (prev !== undefined && now - prev < DEBOUNCE_MS) {
    return { ok: false, status: "debounced" };
  }

  // 4) 큐 enqueue(loopback, 서비스 토큰 Bearer). shell 미경유 — project는 JSON 문자열 필드로만.
  let res: Response;
  try {
    res = await fetch(queueUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ project, change: "-", action: "audit" }),
    });
  } catch {
    return { ok: false, status: "queue_error" };
  }

  if (res.status === 401 || res.status === 403) {
    return { ok: false, status: "unauthorized" };
  }
  if (res.status !== 202) {
    return { ok: false, status: "queue_error" };
  }

  // enqueue 성공 — 디바운스 창 시작.
  lastEnqueueAt.set(project, now);

  let taskId: number | undefined;
  try {
    const body: unknown = await res.json();
    if (typeof body === "object" && body !== null) {
      const tid = (body as { task_id?: unknown }).task_id;
      if (typeof tid === "number") taskId = tid;
    }
  } catch {
    // 202인데 본문 파싱 실패 — enqueue 자체는 성공으로 본다(task_id만 없음).
  }

  return taskId !== undefined ? { ok: true, taskId } : { ok: true };
}
