/**
 * eol — 문서 EOL(줄바꿈) 감지·복원 순수 문자열 유틸.
 *
 * 승인 반영은 /\r?\n/ split → \n join 경로라 CRLF 문서가 LF로 뭉개진다 → 읽을 때 감지한
 * EOL을 쓸 때 복원한다. 혼합 EOL은 첫 `\r\n` 존재 여부로 결정(다수결 아님 — 결정론).
 * 승인 3형제(docs/featureDocs/userFlowDocs)가 공유하는 유일한 헬퍼(로직 공통화 아님).
 */

/** 문서 EOL 감지: `\r\n`이 하나라도 있으면 "\r\n", 아니면 "\n"(CRLF 존재 감지 — any-CRLF-wins 결정론). */
export function detectEol(text: string): "\r\n" | "\n" {
  return text.includes("\r\n") ? "\r\n" : "\n";
}

/** LF 기준으로 조립된 출력의 줄바꿈을 감지된 EOL로 복원(잔존 \r\n은 먼저 정규화 — \r\r\n 방지). */
export function restoreEol(text: string, eol: "\r\n" | "\n"): string {
  const lf = text.replaceAll("\r\n", "\n");
  return eol === "\n" ? lf : lf.replaceAll("\n", "\r\n");
}
