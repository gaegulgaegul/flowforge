/**
 * WireframeDeviceFrame — 디바이스 프레임(데스크탑/모바일) 안에 화면별 HTML 문서를 sandbox iframe으로 렌더한다.
 *
 * flowforge-wireframe-iframe(Phase 5, BREAKING): 좌표 없는 요소 박스(폐기된 `WireScreen2` 렌더러)를
 * 화면별 **실 HTML 문서(WireDoc.html)**로 교체했다. 문서는 `<iframe src sandbox={WIRE_IFRAME_SANDBOX}>`
 * 안에서만 렌더된다 — allow-same-origin 미부여로 부모 오리진(토큰·상태·DOM) 격리.
 *
 * CSP 전달(meta→헤더 전환): iframe은 이제 `srcdoc`가 아니라 `src`(서버 라우트)로 문서를 로드한다.
 * 문서 CSP(WIRE_DOC_CSP)는 그 라우트의 HTTP 응답 헤더로 강제된다(브라우저가 문서 내용과 무관하게 적용
 * → 적대적 HTML의 meta 마스킹 우회 원천 차단). 승인분은 원천에 있으므로 `screenId`로 direct 로드
 * (`.../planning-wireframe/:screenId/doc`), 미승인 제안(위저드)은 원천에 없는 임시 HTML이라 렌더 전
 * POST preview로 토큰을 받아 `.../planning-wireframe/preview/:token/doc`로 로드한다.
 *
 * 디바이스 프레임 크롬(데스크탑 브라우저 크롬 / 모바일 폰 프레임)·디바이스 토글·화면 탭은 재사용한다
 * (게으름 위계 — 프레임 셸 재작성 금지, 본문만 iframe로 교체). 프레임 위 오버레이(핀 레이어)도 유지.
 *
 * ⚠️ 보안 불변식: 와이어 HTML은 sandbox iframe 이외 경로(상위 문서 innerHTML/dangerouslySetInnerHTML)로
 *    삽입하지 않는다. iframe 내부 DOM은 cross-origin 취급이라 접근 불가 — 핀 좌표는 iframe 표면 기준만.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { WireDocDevice, WireDoc } from "@flowforge/shared";
import { WIRE_IFRAME_SANDBOX, isWireNavMessage } from "@flowforge/shared";
import { createWirePreview } from "./api.js";

/** 프레임 위 오버레이 렌더 컨텍스트 — 현재 디바이스/화면 id(핀 필터·좌표계용). */
export interface WireframeOverlayCtx {
  readonly device: WireDocDevice;
  readonly screenId: string;
}

/** 승인분 direct 문서 src(원천 screenId로 서버 라우트 로드 — CSP는 응답 헤더로 강제). */
function directDocSrc(project: string, screenId: string): string {
  return `/api/docs/${encodeURIComponent(project)}/planning-wireframe/${encodeURIComponent(screenId)}/doc`;
}

/**
 * 화면 HTML을 sandbox iframe으로 렌더한다. iframe은 `srcdoc`가 아니라 `src`(서버 라우트)로 문서를
 * 로드하고, sandbox는 shared 상수값(allow-scripts만, allow-same-origin 없음)이라 부모 오리진과
 * cross-origin(opaque)이다 → 격리 유지. CSP는 그 라우트의 응답 헤더로 강제된다(문서로 우회 불가).
 *
 * - 승인분(preview=false): `doc.id`로 direct 라우트를 즉시 src에 건다(왕복 없음).
 * - 미승인 제안(preview=true): `doc.html`이 원천에 없으므로 렌더 전 POST로 미리보기 토큰을 받아
 *   preview 라우트를 src에 건다(비동기 — 발급 전 로딩, 실패 시 에러 메시지).
 */
function DocFrame({
  doc,
  project,
  preview = false,
  frameRef,
}: {
  doc: WireDoc;
  project: string;
  preview?: boolean;
  /** 화면 전환 브리지 발신자 검증용 — 부모가 `event.source === contentWindow`를 대조한다. */
  frameRef?: React.RefObject<HTMLIFrameElement> | undefined;
}): JSX.Element {
  const directSrc = useMemo(
    () => (preview ? null : directDocSrc(project, doc.id)),
    [preview, project, doc.id],
  );
  // 미승인 제안: 토큰 발급 왕복. "loading"=발급 중, string=preview src, "error"=실패.
  const [previewSrc, setPreviewSrc] = useState<string | "loading" | "error">("loading");

  useEffect(() => {
    if (!preview) return;
    let alive = true;
    setPreviewSrc("loading");
    createWirePreview(project, doc.html)
      .then((token) => {
        if (!alive) return;
        setPreviewSrc(
          `/api/docs/${encodeURIComponent(project)}/planning-wireframe/preview/${encodeURIComponent(token)}/doc`,
        );
      })
      .catch(() => {
        if (alive) setPreviewSrc("error");
      });
    return () => {
      alive = false;
    };
  }, [preview, project, doc.html]);

  const src = directSrc ?? previewSrc;
  if (src === "loading") {
    return <div className="wf-df-iframe wf-df-loading" data-testid="wf-df-loading">미리보기 준비 중…</div>;
  }
  if (src === "error") {
    return <div className="wf-df-iframe wf-df-error" data-testid="wf-df-error">미리보기를 불러오지 못했습니다.</div>;
  }
  return (
    <iframe
      ref={frameRef}
      className="wf-df-iframe"
      data-testid="wf-df-iframe"
      title={doc.title}
      sandbox={WIRE_IFRAME_SANDBOX}
      src={src}
    />
  );
}

/**
 * 데스크탑 프레임: 브라우저 크롬 + iframe 본문. overlay(핀 레이어)는 iframe이 담긴 viewport **안**에
 * 넣어, 핀 오버레이의 바운딩 박스가 iframe 표면과 정확히 일치하게 한다(크롬 30px 오프셋 배제 — 핀 좌표는
 * iframe 표면 기준이어야 하므로). viewport는 position:relative 기준이 되도록 CSS에서 고정.
 */
function DesktopScreen({
  doc,
  project,
  preview = false,
  overlay,
  frameRef,
}: {
  doc: WireDoc;
  project: string;
  preview?: boolean;
  overlay?: ReactNode;
  frameRef?: React.RefObject<HTMLIFrameElement> | undefined;
}): JSX.Element {
  return (
    <div className="wf-df-frame wf-df-frame--desktop" data-testid="wf-df-desktop">
      <div className="wf-df-chrome">
        <span className="wf-df-dot" />
        <span className="wf-df-dot" />
        <span className="wf-df-dot" />
        <span className="wf-df-url">flowforge.gaegul.house</span>
      </div>
      <div className="wf-df-viewport">
        <DocFrame doc={doc} project={project} preview={preview} frameRef={frameRef} />
        {overlay}
      </div>
    </div>
  );
}

/** 모바일 프레임: 폰 프레임 + iframe 본문. overlay는 iframe 표면(viewport) 안(핀 좌표 정합). */
function MobileScreen({
  doc,
  project,
  preview = false,
  overlay,
  frameRef,
}: {
  doc: WireDoc;
  project: string;
  preview?: boolean;
  overlay?: ReactNode;
  frameRef?: React.RefObject<HTMLIFrameElement> | undefined;
}): JSX.Element {
  return (
    <div className="wf-df-frame wf-df-frame--mobile" data-testid="wf-df-mobile">
      <div className="wf-df-viewport">
        <DocFrame doc={doc} project={project} preview={preview} frameRef={frameRef} />
        {overlay}
      </div>
    </div>
  );
}

export function WireframeDeviceFrame({
  screens,
  project,
  preview = false,
  hideControls = false,
  renderOverlay,
  focusTarget,
}: {
  screens: readonly WireDoc[];
  /** 현재 프로젝트 키 — iframe src(서버 문서 라우트) 구성에 필요. */
  project: string;
  /**
   * 미승인 제안(위저드)처럼 원천에 없는 임시 HTML이면 true — 렌더 전 POST preview로 토큰을 받아
   * preview 라우트로 로드한다. 기본 false(승인분은 doc.id로 direct 로드).
   */
  preview?: boolean;
  /** 위저드 카드 내 단일 미리보기용 — 디바이스 토글·화면 탭·캡션 크롬을 숨긴다. 첫 화면만 렌더. */
  hideControls?: boolean;
  /**
   * 프레임 위 오버레이(인플레이스 핀 레이어). 활성 화면의 device/screenId를 받아 그 프레임 안에
   * 절대 위치로 렌더된다. 프레임은 device/화면 상태의 단일 소유자 — 오버레이는 컨텍스트만 받는다.
   */
  renderOverlay?: (ctx: WireframeOverlayCtx) => ReactNode;
  /**
   * 외부(핀 목록)에서 특정 화면으로 이동 요청(다른 디바이스 핀 클릭 시 그 디바이스·화면으로 전환).
   * 값이 바뀔 때마다 프레임의 device/화면을 그 대상으로 맞춘다. nonce로 같은 대상 재요청도 트리거.
   */
  focusTarget?: { readonly device: WireDocDevice; readonly screenId: string; readonly nonce: number };
}): JSX.Element {
  const [device, setDevice] = useState<WireDocDevice>(screens[0]?.device ?? "desktop");
  const [activeId, setActiveId] = useState<string>(screens[0]?.id ?? "");
  // 화면 전환 브리지 발신자 검증용 — 이 프레임이 실제로 띄운 창에서 온 메시지만 받는다.
  const frameRef = useRef<HTMLIFrameElement>(null);

  // 외부 이동 요청(핀 목록 클릭) → 그 대상 화면이 실재하면 device·화면을 맞춘다. nonce 변화로 재요청 반영.
  useEffect(() => {
    if (!focusTarget) return;
    if (screens.some((s) => s.id === focusTarget.screenId && s.device === focusTarget.device)) {
      setDevice(focusTarget.device);
      setActiveId(focusTarget.screenId);
    }
  }, [focusTarget, screens]);

  /**
   * 와이어 문서 안의 클릭(`data-nav`) → 화면 전환. 화면 선택 툴바를 대체하는 유일한 전환 경로다.
   *
   * ⚠️ 메시지는 신뢰 불가 입력이다. 문서가 opaque origin(sandbox, allow-same-origin 없음)이라
   * `event.origin`은 `"null"`로 와서 오리진 검증이 불가능하므로, 대신 두 겹으로 막는다:
   *   1) `event.source === frameRef.current.contentWindow` — 이 프레임이 띄운 창이 보낸 것만 수용
   *      (다른 탭·다른 iframe·확장이 보낸 메시지 배제).
   *   2) 받은 screenId를 실재 화면 목록과 대조 — 없는 화면이면 무시(focusTarget과 동일한 화이트리스트).
   * 수용해도 하는 일은 "어느 화면을 보여줄지" 상태 변경뿐이라 문서에 부모 권한이 새지 않는다.
   */
  useEffect(() => {
    const onMessage = (e: MessageEvent): void => {
      if (!frameRef.current || e.source !== frameRef.current.contentWindow) return;
      if (!isWireNavMessage(e.data)) return;
      const target = screens.find((s) => s.id === e.data.screenId);
      if (!target) return; // 실재하지 않는 화면 id — 무시
      setDevice(target.device);
      setActiveId(target.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [screens]);

  // 현재 디바이스에 해당하는 화면들(desktop이면 desktop 화면, mobile이면 mobile 화면).
  const deviceScreens = useMemo(() => screens.filter((s) => s.device === device), [screens, device]);

  // 활성 화면 = activeId가 현재 디바이스에 있으면 그것, 없으면 이 디바이스 첫 화면(디바이스 전환 시 폴백).
  const active = deviceScreens.find((s) => s.id === activeId) ?? deviceScreens[0] ?? null;

  if (!active) {
    return <div className="wf-df-empty">표시할 화면이 없습니다.</div>;
  }

  // 활성 화면 위 오버레이(핀 레이어). 화면이 바뀌면 컨텍스트(device·screenId)가 바뀌어 그 화면 핀만 뜬다.
  const overlay = renderOverlay?.({ device: active.device, screenId: active.id });

  // 위저드 카드 미리보기: 크롬(토글·탭·캡션) 없이 스테이지만 — 첫 화면 프레임 하나.
  if (hideControls) {
    return (
      <div className="wf-df-root wf-df-root--preview">
        <div className="wf-df-stage">
          {active.device === "desktop" ? (
            <DesktopScreen doc={active} project={project} preview={preview} overlay={overlay} frameRef={frameRef} />
          ) : (
            <MobileScreen doc={active} project={project} preview={preview} overlay={overlay} frameRef={frameRef} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="wf-df-root">
      <div className="wf-df-controls">
        <div className="wf-df-device-toggle" role="group" aria-label="디바이스">
          <button
            type="button"
            className={device === "desktop" ? "on" : ""}
            aria-pressed={device === "desktop"}
            data-testid="wf-df-device-desktop"
            onClick={() => setDevice("desktop")}
          >
            🖥 데스크탑
          </button>
          <button
            type="button"
            className={device === "mobile" ? "on" : ""}
            aria-pressed={device === "mobile"}
            data-testid="wf-df-device-mobile"
            onClick={() => setDevice("mobile")}
          >
            📱 모바일
          </button>
        </div>
        {/* 화면 선택 탭은 없앴다 — 화면 전환은 와이어 안의 요소(data-nav) 클릭으로만 한다(실제 앱과 동형). */}
        <span className="wf-df-now" data-testid="wf-df-now">{active.title}</span>
      </div>
      <div className="wf-df-stage">
        {active.device === "desktop" ? (
          <DesktopScreen doc={active} project={project} preview={preview} overlay={overlay} frameRef={frameRef} />
        ) : (
          <MobileScreen doc={active} project={project} preview={preview} overlay={overlay} frameRef={frameRef} />
        )}
      </div>
      <p className="wf-df-caption">
        화면별 HTML 문서 미리보기 — 입력·버튼이 실제로 동작합니다 <b>(최종 디자인 아님)</b>
      </p>
    </div>
  );
}
