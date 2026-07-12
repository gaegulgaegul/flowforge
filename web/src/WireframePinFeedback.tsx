/**
 * 인플레이스 핀 피드백 (planning-wireframe-generation-feedback — D2 정정: Figma 코멘트식).
 *
 * Figma 코멘트식. "화면마다 입력칸 나열"이 아니라, 와이어 위 고칠 그 지점을 [핀 모드] 켜고 클릭 →
 * 클릭한 그 좌표에 팝오버(textarea)가 뜨고, 저장하면 그 좌표에 핀(번호 마커)이 꽂힌다. 핀·오른쪽 목록을
 * 클릭하면 그 피드백이 다시 열린다(수정 가능).
 *
 * flowforge-wireframe-iframe 이후: 와이어 본문이 sandbox iframe이라 iframe 내부 DOM엔 접근할 수 없다
 * (cross-origin 경계). 따라서 핀 좌표(xPct·yPct 0~100)는 iframe **표면**(오버레이 바운딩 박스) 상대
 * 위치다. 보기 모드에선 오버레이가 pointer-events:none이라 iframe이 클릭을 받아 문서 동작(입력/버튼)이
 * 살고, 핀 모드 armed 시에만 오버레이가 클릭을 캡처해 핀을 찍는다(모드별 pointer-events 토글).
 *
 * flowforge는 feedback 사이드카에 write만 하고 AI를 호출하지 않는다(A안 파일 릴레이). 서버는 feedback을
 * 읽어 그 지점만 재생성한다(즉시성 없음).
 *
 * WireframeDeviceFrame(디바이스 프레임·device/화면 상태의 단일 소유자)을 재사용하고, 프레임 위 오버레이
 * (renderOverlay)로 핀 레이어만 얹는다(게으름 위계 — 프레임을 다시 만들지 않음). 좌표 계산은 표준 DOM
 * (getBoundingClientRect), 새 라이브러리 없음.
 */
import { useEffect, useRef, useState } from "react";
import type { WireDocDevice, WireDoc } from "@flowforge/shared";
import { WireframeDeviceFrame } from "./WireframeDeviceFrame.js";
import type { WireframeOverlayCtx } from "./WireframeDeviceFrame.js";
import { postWireframeFeedback } from "./api.js";

/** 프레임에 넘길 이동 요청(핀 목록 클릭 → 그 디바이스·화면으로 전환). nonce로 같은 대상 재요청도 트리거. */
interface FocusTarget {
  readonly device: WireDocDevice;
  readonly screenId: string;
  readonly nonce: number;
}

/** 화면에 꽂힌 핀 1개(로컬 세션 상태 + 서버 append 완료분). id=화면 내 표시 번호. */
interface Pin {
  readonly id: number;
  readonly screenId: string;
  readonly device: WireDocDevice;
  readonly xPct: number;
  readonly yPct: number;
  readonly text: string;
  readonly region: string;
}

/** 열린 팝오버 상태 — 새 지점(editId 없음) 또는 기존 핀 수정(editId 있음). */
interface Editor {
  readonly screenId: string;
  readonly device: WireDocDevice;
  readonly xPct: number;
  readonly yPct: number;
  readonly editId: number | null;
}

/** 좌표(0~100%)에서 영역 자동 인식 — 디바이스별 y/x 임계(목업 regionAt 로직). */
function regionAt(device: WireDocDevice, xPct: number, yPct: number): string {
  if (device === "mobile") {
    if (yPct < 20) return "상단바";
    if (yPct > 82) return "하단 메뉴바";
    return "본문";
  }
  if (yPct < 22) return "상단 메뉴";
  if (xPct < 20) return "사이드 메뉴";
  return "본문";
}

type SaveState = "idle" | "sending" | "error";

/** 팝오버(textarea + 저장/취소) — 새 지점 또는 기존 핀 수정. 저장 성공 시 onSaved 콜백. */
function PinPopover({
  editor,
  initialText,
  onSaved,
  onClose,
}: {
  editor: Editor;
  initialText: string;
  onSaved: (text: string, region: string) => Promise<void>;
  onClose: () => void;
}): JSX.Element {
  const [text, setText] = useState(initialText);
  const [state, setState] = useState<SaveState>("idle");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const region = regionAt(editor.device, editor.xPct, editor.yPct);

  useEffect(() => {
    taRef.current?.focus();
  }, []);

  const canSave = text.trim().length > 0 && state !== "sending";
  const save = (): void => {
    if (!canSave) return; // 빈 텍스트·중복 전송 차단
    setState("sending");
    onSaved(text.trim(), region)
      .then(() => onClose())
      .catch(() => setState("error"));
  };

  return (
    <div
      className="wf-pin-pop"
      style={{ left: `${editor.xPct}%`, top: `${editor.yPct}%` }}
      data-testid="wf-pin-pop"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="wf-pin-pop-h">📌 {editor.editId !== null ? "피드백" : "이 지점에 피드백"}</div>
      <textarea
        ref={taRef}
        className="wf-pin-pop-ta"
        data-testid="wf-pin-pop-ta"
        placeholder="여기를 어떻게 바꿀지 (예: 이 버튼을 더 크게 / 하단을 탭바로)"
        value={text}
        disabled={state === "sending"}
        onChange={(e) => {
          setText(e.target.value);
          if (state === "error") setState("idle");
        }}
      />
      <div className="wf-pin-pop-loc">
        위치: {region} · {Math.round(editor.xPct)}%,{Math.round(editor.yPct)}%
      </div>
      <div className="wf-pin-pop-actions">
        <button type="button" className="wf-pin-btn" data-testid="wf-pin-cancel" onClick={onClose}>
          취소
        </button>
        <button
          type="button"
          className="wf-pin-btn wf-pin-btn--save"
          data-testid="wf-pin-save"
          disabled={!canSave}
          onClick={save}
        >
          {state === "sending" ? "저장 중…" : "저장"}
        </button>
      </div>
      {state === "error" && (
        <div className="wf-pin-pop-err" data-testid="wf-pin-err">
          저장하지 못했습니다(다시 시도).
        </div>
      )}
    </div>
  );
}

/** 프레임 위 핀 레이어 — 클릭 캡처(⌘/핀모드) + 이 화면 핀 렌더 + 열린 팝오버. */
function PinLayer({
  ctx,
  pinMode,
  pins,
  editor,
  onPlace,
  onOpen,
  onSaved,
  onClose,
}: {
  ctx: WireframeOverlayCtx;
  pinMode: boolean;
  pins: readonly Pin[];
  editor: Editor | null;
  onPlace: (editor: Editor) => void;
  onOpen: (pin: Pin) => void;
  onSaved: (editor: Editor, text: string, region: string) => Promise<void>;
  onClose: () => void;
}): JSX.Element {
  const visible = pins.filter((p) => p.screenId === ctx.screenId && p.device === ctx.device);
  const editing = editor && editor.screenId === ctx.screenId && editor.device === ctx.device ? editor : null;

  // 좌표는 오버레이(=iframe 표면) 바운딩 박스 기준 xPct/yPct(0~100). iframe 내부 DOM엔 접근하지 않는다
  // (sandbox cross-origin 경계). 보기 모드에선 오버레이가 pointer-events:none이라 이 핸들러가 안 불리고
  // iframe이 클릭을 받아 문서 동작이 살아난다. 핀 모드 armed 시에만 오버레이가 클릭을 캡처해 핀을 찍는다.
  const onLayerClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    if (!(pinMode || e.metaKey || e.ctrlKey)) return; // 보기 모드 일반 클릭은 무시
    const r = e.currentTarget.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return; // 방어(레이아웃 미완)
    const xPct = ((e.clientX - r.left) / r.width) * 100;
    const yPct = ((e.clientY - r.top) / r.height) * 100;
    onPlace({ screenId: ctx.screenId, device: ctx.device, xPct, yPct, editId: null });
  };

  const initialText = editing?.editId != null ? (pins.find((p) => p.id === editing.editId)?.text ?? "") : "";

  return (
    <div
      className={`wf-pin-layer${pinMode ? " wf-pin-layer--armed" : ""}`}
      data-testid="wf-pin-layer"
      onClick={onLayerClick}
    >
      {visible.map((p) => (
        <button
          key={p.id}
          type="button"
          className={`wf-pin${editing?.editId === p.id ? " wf-pin--active" : ""}`}
          style={{ left: `${p.xPct}%`, top: `${p.yPct}%` }}
          data-testid={`wf-pin-${p.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(p);
          }}
        >
          <span className="wf-pin-head">{p.id}</span>
        </button>
      ))}
      {editing && (
        <PinPopover
          key={`${editing.editId ?? "new"}-${editing.xPct}-${editing.yPct}`}
          editor={editing}
          initialText={initialText}
          onSaved={(text, region) => onSaved(editing, text, region)}
          onClose={onClose}
        />
      )}
    </div>
  );
}

/** 오른쪽 목록 — 전체 핀(디바이스 무관). 클릭 시 그 핀 재열림(다른 디바이스면 안내는 프레임이 처리). */
function PinList({ pins, activeId, onOpen }: { pins: readonly Pin[]; activeId: number | null; onOpen: (pin: Pin) => void }): JSX.Element {
  return (
    <aside className="wf-pin-side" data-testid="wf-pin-side">
      <h4 className="wf-pin-side-h">이 프로젝트의 피드백</h4>
      <div className="wf-pin-side-cnt">{pins.length}개 · 핀을 클릭하면 열립니다</div>
      {pins.length === 0 ? (
        <div className="wf-pin-empty" data-testid="wf-pin-empty">
          아직 없습니다.
          <br />
          와이어를 ⌘+클릭해 첫 피드백을 남겨보세요.
        </div>
      ) : (
        <div className="wf-pin-list">
          {pins.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`wf-pin-row${p.id === activeId ? " wf-pin-row--active" : ""}`}
              data-testid={`wf-pin-row-${p.id}`}
              onClick={() => onOpen(p)}
            >
              <span className="wf-pin-num">{p.id}</span>
              <span className="wf-pin-row-body">
                <span className="wf-pin-row-txt">{p.text}</span>
                <span className="wf-pin-row-meta">
                  {p.region} · {p.device === "mobile" ? "모바일" : "데스크탑"} · {p.screenId}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="wf-pin-relay">
        저장한 피드백은 <b>그 화면의 그 좌표</b>에 묶여 파일로 기록되고(A안 릴레이), 외부 AI가 읽어 <b>그 지점만</b> 다시 그립니다.
      </div>
    </aside>
  );
}

/**
 * 인플레이스 핀 피드백 뷰 — 디바이스 프레임(WireframeDeviceFrame) + 핀 레이어 + 피드백 목록.
 * 프레임이 device/화면 상태의 단일 소유자라 renderOverlay로 활성 화면 컨텍스트를 받아 핀을 얹는다.
 */
export function WireframePinFeedback({
  project,
  screens,
}: {
  project: string;
  screens: readonly WireDoc[];
}): JSX.Element | null {
  const [pins, setPins] = useState<Pin[]>([]);
  const [seq, setSeq] = useState(0);
  const [pinMode, setPinMode] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [focusTarget, setFocusTarget] = useState<FocusTarget | null>(null);
  const focusNonce = useRef(0);

  // Esc로 팝오버 닫기(목업 동작).
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setEditor(null);
        setActiveId(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (screens.length === 0) return null;

  const openExisting = (pin: Pin): void => {
    setActiveId(pin.id);
    setEditor({ screenId: pin.screenId, device: pin.device, xPct: pin.xPct, yPct: pin.yPct, editId: pin.id });
    // 다른 디바이스/화면의 핀이면 프레임을 그 화면으로 이동시켜 팝오버가 뜨게 한다(목업 list-click 동작).
    focusNonce.current += 1;
    setFocusTarget({ device: pin.device, screenId: pin.screenId, nonce: focusNonce.current });
  };

  const closeEditor = (): void => {
    setEditor(null);
    setActiveId(null);
  };

  // 저장: 서버에 append(빈텍스트·범위밖은 서버 최종 방어) 후 로컬 핀 반영. 실패는 팝오버가 표면화(throw).
  const onSaved = async (ed: Editor, text: string, region: string): Promise<void> => {
    await postWireframeFeedback(project, { screenId: ed.screenId, text, xPct: ed.xPct, yPct: ed.yPct, region });
    if (ed.editId !== null) {
      setPins((prev) => prev.map((p) => (p.id === ed.editId ? { ...p, text, region } : p)));
    } else {
      const id = seq + 1;
      setSeq(id);
      setPins((prev) => [...prev, { id, screenId: ed.screenId, device: ed.device, xPct: ed.xPct, yPct: ed.yPct, text, region }]);
    }
  };

  return (
    <div className="wf-pin-root" data-testid="wf-pin">
      <div className="wf-pin-toolbar">
        <span className="wf-pin-hint">
          [핀 모드]를 켜고 와이어를 클릭 → 그 자리에 피드백을 남깁니다 (핀 모드가 꺼져 있으면 와이어의 버튼·입력이 실제로 동작)
        </span>
        <button
          type="button"
          className={`wf-pin-mode${pinMode ? " on" : ""}`}
          data-testid="wf-pin-mode"
          aria-pressed={pinMode}
          onClick={() => setPinMode((v) => !v)}
        >
          📌 핀 모드 {pinMode ? "켬" : "끔"}
        </button>
      </div>
      <div className="wf-pin-stage">
        <WireframeDeviceFrame
          screens={screens}
          {...(focusTarget ? { focusTarget } : {})}
          renderOverlay={(ctx) => (
            <PinLayer
              ctx={ctx}
              pinMode={pinMode}
              pins={pins}
              editor={editor}
              onPlace={(ed) => {
                setActiveId(null);
                setEditor(ed);
              }}
              onOpen={openExisting}
              onSaved={onSaved}
              onClose={closeEditor}
            />
          )}
        />
        <PinList pins={pins} activeId={activeId} onOpen={openExisting} />
      </div>
    </div>
  );
}
