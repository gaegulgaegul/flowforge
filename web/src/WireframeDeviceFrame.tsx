/**
 * WireframeDeviceFrame — 디바이스 프레임(데스크탑/모바일) 안에 화면별 HTML 문서를 sandbox iframe으로 렌더한다.
 *
 * flowforge-wireframe-iframe(Phase 5, BREAKING): 좌표 없는 요소 박스(폐기된 `WireScreen2` 렌더러)를
 * 화면별 **실 HTML 문서(WireDoc.html)**로 교체했다. 문서는 `<iframe srcdoc sandbox={WIRE_IFRAME_SANDBOX}>`
 * 안에서만 렌더된다 — allow-same-origin 미부여로 부모 오리진(토큰·상태·DOM) 격리, 문서 CSP(WIRE_DOC_CSP)
 * 주입으로 외부 리소스 로드·네트워크 유출 차단. 진짜 HTML이라 입력/버튼/폼이 실제로 동작한다(피드백5).
 *
 * 디바이스 프레임 크롬(데스크탑 브라우저 크롬 / 모바일 폰 프레임)·디바이스 토글·화면 탭은 재사용한다
 * (게으름 위계 — 프레임 셸 재작성 금지, 본문만 iframe로 교체). 프레임 위 오버레이(핀 레이어)도 유지.
 *
 * ⚠️ 보안 불변식: 와이어 HTML은 sandbox iframe 이외 경로(상위 문서 innerHTML/dangerouslySetInnerHTML)로
 *    삽입하지 않는다. iframe 내부 DOM은 cross-origin 취급이라 접근 불가 — 핀 좌표는 iframe 표면 기준만.
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { WireDocDevice, WireDoc } from "@flowforge/shared";
import { WIRE_IFRAME_SANDBOX, injectWireDocCsp } from "@flowforge/shared";

/** 프레임 위 오버레이 렌더 컨텍스트 — 현재 디바이스/화면 id(핀 필터·좌표계용). */
export interface WireframeOverlayCtx {
  readonly device: WireDocDevice;
  readonly screenId: string;
}

/**
 * 화면 HTML을 sandbox iframe으로 렌더한다. srcdoc에 CSP 주입 문서(injectWireDocCsp — 주석 우회 방어
 * 포함, shared 단일 원천)를 넣고, sandbox는 shared 상수값(allow-scripts만, allow-same-origin 없음).
 * iframe 내부는 격리 경계라 부모 컨텍스트에 도달할 수 없다.
 */
function DocFrame({ doc }: { doc: WireDoc }): JSX.Element {
  const srcDoc = useMemo(() => injectWireDocCsp(doc.html), [doc.html]);
  return (
    <iframe
      className="wf-df-iframe"
      data-testid="wf-df-iframe"
      title={doc.title}
      sandbox={WIRE_IFRAME_SANDBOX}
      srcDoc={srcDoc}
    />
  );
}

/**
 * 데스크탑 프레임: 브라우저 크롬 + iframe 본문. overlay(핀 레이어)는 iframe이 담긴 viewport **안**에
 * 넣어, 핀 오버레이의 바운딩 박스가 iframe 표면과 정확히 일치하게 한다(크롬 30px 오프셋 배제 — 핀 좌표는
 * iframe 표면 기준이어야 하므로). viewport는 position:relative 기준이 되도록 CSS에서 고정.
 */
function DesktopScreen({ doc, overlay }: { doc: WireDoc; overlay?: ReactNode }): JSX.Element {
  return (
    <div className="wf-df-frame wf-df-frame--desktop" data-testid="wf-df-desktop">
      <div className="wf-df-chrome">
        <span className="wf-df-dot" />
        <span className="wf-df-dot" />
        <span className="wf-df-dot" />
        <span className="wf-df-url">flowforge.gaegul.house</span>
      </div>
      <div className="wf-df-viewport">
        <DocFrame doc={doc} />
        {overlay}
      </div>
    </div>
  );
}

/** 모바일 프레임: 폰 프레임 + iframe 본문. overlay는 iframe 표면(viewport) 안(핀 좌표 정합). */
function MobileScreen({ doc, overlay }: { doc: WireDoc; overlay?: ReactNode }): JSX.Element {
  return (
    <div className="wf-df-frame wf-df-frame--mobile" data-testid="wf-df-mobile">
      <div className="wf-df-viewport">
        <DocFrame doc={doc} />
        {overlay}
      </div>
    </div>
  );
}

export function WireframeDeviceFrame({
  screens,
  hideControls = false,
  renderOverlay,
  focusTarget,
}: {
  screens: readonly WireDoc[];
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

  // 외부 이동 요청(핀 목록 클릭) → 그 대상 화면이 실재하면 device·화면을 맞춘다. nonce 변화로 재요청 반영.
  useEffect(() => {
    if (!focusTarget) return;
    if (screens.some((s) => s.id === focusTarget.screenId && s.device === focusTarget.device)) {
      setDevice(focusTarget.device);
      setActiveId(focusTarget.screenId);
    }
  }, [focusTarget, screens]);

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
            <DesktopScreen doc={active} overlay={overlay} />
          ) : (
            <MobileScreen doc={active} overlay={overlay} />
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
        <div className="wf-df-screen-tabs" role="group" aria-label="화면">
          {deviceScreens.map((s) => (
            <button
              key={s.id}
              type="button"
              className={s.id === active.id ? "on" : ""}
              aria-pressed={s.id === active.id}
              data-testid={`wf-df-screen-${s.id}`}
              onClick={() => setActiveId(s.id)}
            >
              {s.title}
            </button>
          ))}
        </div>
      </div>
      <div className="wf-df-stage">
        {active.device === "desktop" ? (
          <DesktopScreen doc={active} overlay={overlay} />
        ) : (
          <MobileScreen doc={active} overlay={overlay} />
        )}
      </div>
      <p className="wf-df-caption">
        화면별 HTML 문서 미리보기 — 입력·버튼이 실제로 동작합니다 <b>(최종 디자인 아님)</b>
      </p>
    </div>
  );
}
