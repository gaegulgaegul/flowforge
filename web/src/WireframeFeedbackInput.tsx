/**
 * 화면별 자유 텍스트 피드백 입력 (planning-wireframe-generation-feedback — Parallel Group 3, D8).
 *
 * 각 와이어 화면에 대해 자유 텍스트 textarea + 제출 버튼을 제공한다. 제출하면 그 화면 id로
 * `postWireframeFeedback`(feedback 사이드카 write)을 호출한다 — 위저드 승인/반려와 **독립된 별도
 * 경로**(D8: 위저드 onApply는 자유 텍스트를 못 나름). flowforge는 write만 하고 AI를 호출하지 않는다
 * (A안 파일 릴레이). 밖의 스킬이 feedback을 읽어 그 화면만 재생성 → 재조회로 반영(즉시성 없음).
 *
 * 빈 텍스트(공백만)는 제출을 막고, 제출 성공 후 "접수됨"을 표시한다(재조회 시 재생성분 반영 가능 안내).
 */
import { useState } from "react";
import type { WireScreen2 } from "@flowforge/shared";
import { postWireframeFeedback } from "./api.js";

type SubmitState = "idle" | "sending" | "done" | "error";

/** 한 화면의 피드백 입력 행 — 자체 텍스트·제출 상태를 소유(다른 화면과 독립). */
function ScreenFeedbackRow({
  project,
  screen,
}: {
  project: string;
  screen: WireScreen2;
}): JSX.Element {
  const [text, setText] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");

  const canSubmit = text.trim().length > 0 && state !== "sending";

  const submit = (): void => {
    if (!canSubmit) return; // 빈 텍스트·중복 전송 차단
    setState("sending");
    setError("");
    postWireframeFeedback(project, { screenId: screen.id, text })
      .then(() => {
        setState("done");
        setText(""); // 접수 후 입력칸 비움 — 같은 피드백 중복 제출 유도 방지
      })
      .catch((e: unknown) => {
        setState("error");
        setError(String(e));
      });
  };

  return (
    <div className="wire-feedback-row" data-testid={`wire-feedback-${screen.id}`}>
      <div className="wire-feedback-head">
        <span className="wire-feedback-title">{screen.title || screen.id}</span>
        <span className="wire-feedback-id">{screen.id}</span>
      </div>
      <textarea
        className="wire-feedback-textarea"
        data-testid={`wire-feedback-text-${screen.id}`}
        placeholder="이 화면을 어떻게 바꿀지 적어주세요 (예: 하단 메뉴를 탭바로 바꿔줘)"
        value={text}
        disabled={state === "sending"}
        onChange={(e) => {
          setText(e.target.value);
          if (state === "done" || state === "error") setState("idle"); // 다시 입력하면 상태 초기화
        }}
      />
      <div className="wire-feedback-actions">
        <button
          type="button"
          className="wire-feedback-submit"
          data-testid={`wire-feedback-submit-${screen.id}`}
          disabled={!canSubmit}
          onClick={submit}
        >
          {state === "sending" ? "보내는 중…" : "피드백 보내기"}
        </button>
        {state === "done" && (
          <span className="wire-feedback-ok" data-testid={`wire-feedback-ok-${screen.id}`}>
            ✓ 접수됨 — 재조회 시 재생성분이 반영될 수 있습니다
          </span>
        )}
        {state === "error" && (
          <span className="wire-feedback-err" data-testid={`wire-feedback-err-${screen.id}`}>
            {error || "전송 실패"}
          </span>
        )}
      </div>
    </div>
  );
}

export function WireframeFeedbackInput({
  project,
  screens,
}: {
  project: string;
  screens: readonly WireScreen2[];
}): JSX.Element | null {
  if (screens.length === 0) return null;
  return (
    <div className="wire-feedback" data-testid="wire-feedback">
      <h4 className="wire-feedback-h">화면별 피드백</h4>
      <p className="wire-feedback-caption">
        화면마다 바꾸고 싶은 점을 남기면, 그 화면만 다시 그려집니다(다시 불러오면 반영).
      </p>
      {screens.map((s) => (
        <ScreenFeedbackRow key={s.id} project={project} screen={s} />
      ))}
    </div>
  );
}
