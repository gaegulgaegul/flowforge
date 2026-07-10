/**
 * WireframeDeviceFrame — 디바이스 프레임(데스크탑/모바일) 안에 화면 레이아웃을 배치 렌더한다.
 *
 * 확정 목업(wireframe-mockup-deploy)의 React 번역: 데스크탑=브라우저 크롬 + 상단 메뉴 + 사이드 +
 * 본문(grid/stack/tree/form), 모바일=폰 프레임 + 상단 타이틀 + 본문 + 하단 메뉴바. 회색조 로우피델리티.
 * 요소의 goto를 클릭하면 대상 화면으로 이동(클릭 프로토타입 기본). 디바이스 토글로 데스크탑/모바일 전환.
 *
 * 폐기된 WireframePanel(요소 세로 박스 스택)과 달리 요소를 실제 화면처럼 배치한다(세로 목록 아님).
 * change 경로 와이어(WireframePanel)는 그대로 병존한다(D-4).
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { WireDevice, WireElement, WireScreen2 } from "@flowforge/shared";

/** 프레임 위 오버레이 렌더 컨텍스트 — 현재 디바이스/화면 id(핀 필터·영역 인식용, D2). */
export interface WireframeOverlayCtx {
  readonly device: WireDevice;
  readonly screenId: string;
}

/** 요소 하나 — kind별 로우피델리티 박스. goto 있으면 클릭 이동. */
function Element({
  el,
  onGoto,
}: {
  el: WireElement;
  onGoto: (id: string) => void;
}): JSX.Element {
  const clickable = el.goto !== undefined;
  const style = el.span && el.span > 1 ? { gridColumn: `span ${el.span}` } : undefined;
  const cls = `wf-df-el wf-df-el--${el.kind}${clickable ? " wf-df-el--go" : ""}`;
  if (clickable) {
    return (
      <button
        type="button"
        className={cls}
        style={style}
        data-testid={`wf-df-el-${el.kind}`}
        data-goto={el.goto}
        onClick={() => onGoto(el.goto as string)}
        title={`${el.label} → ${el.goto}`}
      >
        <span className="wf-df-el-label">{el.label}</span>
        <span className="wf-df-el-arrow">▶</span>
      </button>
    );
  }
  return (
    <div className={cls} style={style} data-testid={`wf-df-el-${el.kind}`}>
      <span className="wf-df-el-label">{el.label}</span>
    </div>
  );
}

/** 데스크탑 프레임: 브라우저 크롬 + 상단 메뉴 + (사이드) + 본문. overlay는 프레임 위(핀 레이어). */
function DesktopScreen({
  screen,
  onGoto,
  overlay,
}: {
  screen: WireScreen2;
  onGoto: (id: string) => void;
  overlay?: ReactNode;
}): JSX.Element {
  const { regions } = screen;
  return (
    <div className="wf-df-frame wf-df-frame--desktop" data-testid="wf-df-desktop">
      {overlay}
      <div className="wf-df-chrome">
        <span className="wf-df-dot" />
        <span className="wf-df-dot" />
        <span className="wf-df-dot" />
        <span className="wf-df-url">flowforge.gaegul.house</span>
      </div>
      <div className="wf-df-viewport">
        {regions.topbar && (
          <div className="wf-df-topbar" data-testid="wf-df-topbar">
            {regions.topbar.map((el, i) => (
              <Element key={i} el={el} onGoto={onGoto} />
            ))}
          </div>
        )}
        <div className="wf-df-dbody">
          {regions.sidebar && (
            <nav className="wf-df-sidebar" data-testid="wf-df-sidebar">
              {regions.sidebar.map((el, i) => (
                <Element key={i} el={el} onGoto={onGoto} />
              ))}
            </nav>
          )}
          <div className={`wf-df-main wf-df-main--${regions.body.layout}`} data-testid="wf-df-body">
            {regions.body.elements.map((el, i) => (
              <Element key={i} el={el} onGoto={onGoto} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 모바일 프레임: 폰 프레임 + 상단 타이틀 + 본문 + 하단 메뉴바. overlay는 프레임 위(핀 레이어). */
function MobileScreen({
  screen,
  onGoto,
  overlay,
}: {
  screen: WireScreen2;
  onGoto: (id: string) => void;
  overlay?: ReactNode;
}): JSX.Element {
  const { regions } = screen;
  return (
    <div className="wf-df-frame wf-df-frame--mobile" data-testid="wf-df-mobile">
      {overlay}
      <div className="wf-df-viewport">
        <div className="wf-df-mtopbar" data-testid="wf-df-topbar">
          {(regions.topbar ?? [{ kind: "text" as const, label: screen.title }]).map((el, i) => (
            <Element key={i} el={el} onGoto={onGoto} />
          ))}
        </div>
        <div className={`wf-df-mbody wf-df-main--${regions.body.layout}`} data-testid="wf-df-body">
          {regions.body.elements.map((el, i) => (
            <Element key={i} el={el} onGoto={onGoto} />
          ))}
        </div>
        {regions.bottombar && (
          <nav className="wf-df-bottombar" data-testid="wf-df-bottombar">
            {regions.bottombar.map((el, i) => (
              <Element key={i} el={el} onGoto={onGoto} />
            ))}
          </nav>
        )}
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
  screens: readonly WireScreen2[];
  /** 위저드 카드 내 단일 미리보기용(D7) — 디바이스 토글·화면 탭·캡션 크롬을 숨긴다. 첫 화면만 그대로 렌더. */
  hideControls?: boolean;
  /**
   * 프레임 위 오버레이(인플레이스 핀 레이어, D2). 활성 화면의 device/screenId를 받아 그 프레임 안에
   * 절대 위치로 렌더된다. 프레임은 device/화면 상태의 단일 소유자 — 오버레이는 컨텍스트만 받는다.
   */
  renderOverlay?: (ctx: WireframeOverlayCtx) => ReactNode;
  /**
   * 외부(핀 목록)에서 특정 화면으로 이동 요청(D2 — 다른 디바이스 핀 클릭 시 그 디바이스·화면으로 전환).
   * 값이 바뀔 때마다 프레임의 device/화면을 그 대상으로 맞춘다. nonce로 같은 대상 재요청도 트리거.
   */
  focusTarget?: { readonly device: WireDevice; readonly screenId: string; readonly nonce: number };
}): JSX.Element {
  const [device, setDevice] = useState<WireDevice>(screens[0]?.device ?? "desktop");
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
  const active =
    deviceScreens.find((s) => s.id === activeId) ?? deviceScreens[0] ?? null;

  // goto = 대상 화면 id. 같은 디바이스에 있으면 그대로, 없으면(예: desktop→mobile 전용) 무시하지 않고
  // 현재 디바이스에 존재하는 대상만 이동(끊긴 이동은 no-op — 방어).
  function goto(id: string): void {
    if (screens.some((s) => s.id === id && s.device === device)) {
      setActiveId(id);
    } else if (screens.some((s) => s.id === id)) {
      // 대상이 다른 디바이스에만 있으면 그 디바이스로 전환 후 이동.
      const target = screens.find((s) => s.id === id);
      if (target) {
        setDevice(target.device);
        setActiveId(id);
      }
    }
  }

  if (!active) {
    return <div className="wf-df-empty">표시할 화면이 없습니다.</div>;
  }

  // 활성 화면 위 오버레이(핀 레이어). 화면이 바뀌면 컨텍스트(device·screenId)가 바뀌어 그 화면 핀만 뜬다.
  const overlay = renderOverlay?.({ device: active.device, screenId: active.id });

  // 위저드 카드 미리보기(D7): 크롬(토글·탭·캡션) 없이 스테이지만 — 첫 화면 프레임 하나.
  if (hideControls) {
    return (
      <div className="wf-df-root wf-df-root--preview">
        <div className="wf-df-stage">
          {active.device === "desktop" ? (
            <DesktopScreen screen={active} onGoto={goto} overlay={overlay} />
          ) : (
            <MobileScreen screen={active} onGoto={goto} overlay={overlay} />
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
          <DesktopScreen screen={active} onGoto={goto} overlay={overlay} />
        ) : (
          <MobileScreen screen={active} onGoto={goto} overlay={overlay} />
        )}
      </div>
      <p className="wf-df-caption">
        회색조 로우피델리티 — 요소 배치와 화면 흐름 점검용 <b>(최종 디자인 아님)</b>
      </p>
    </div>
  );
}
