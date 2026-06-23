/** PRD 패널 — 파생된 manyfast 고정 5섹션을 읽기전용 문서로 렌더(편집/저장 없음). */
import type { Prd, PrdSection } from "@flowforge/shared";

/** `**굵게**`만 인라인 변환해 React 노드 배열로 반환(dangerouslySetInnerHTML 미사용, 텍스트는 자동 이스케이프). */
function renderInline(text: string): (string | JSX.Element)[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts
    .filter((p) => p !== "")
    .map((part, i) => {
      const m = /^\*\*([^*]+)\*\*$/.exec(part);
      if (m) {
        return <strong key={i}>{m[1] ?? ""}</strong>;
      }
      return part;
    });
}

/**
 * 경량 마크다운 렌더(외부 패키지 없음). 줄 단위 처리:
 * - `## `/`### ` 헤더 → 소제목
 * - `- `/`* ` 연속 줄 → <ul><li>
 * - `|...|` 표 줄 → <pre>(원문 보존, 깨지지 않게)
 * - 빈 줄 → 단락 구분, 그 외 → <p>
 * 인라인 `**굵게**`는 renderInline으로 변환.
 */
function renderMarkdown(body: string): JSX.Element[] {
  const lines = body.split("\n");
  const blocks: JSX.Element[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = (): void => {
    if (listBuffer.length === 0) return;
    const items = listBuffer;
    listBuffer = [];
    blocks.push(
      <ul key={key++} className="prd-list">
        {items.map((item, i) => (
          <li key={i} className="prd-list-item">
            {renderInline(item)}
          </li>
        ))}
      </ul>,
    );
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    if (line.trim() === "") {
      flushList();
      continue;
    }

    const heading = /^(#{2,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushList();
      blocks.push(
        <h4 key={key++} className="prd-subheading">
          {renderInline(heading[2] ?? "")}
        </h4>,
      );
      continue;
    }

    const listItem = /^[-*]\s+(.*)$/.exec(line);
    if (listItem) {
      listBuffer.push(listItem[1] ?? "");
      continue;
    }

    // 표 줄: 완벽 렌더 대신 원문 그대로 보존(깨지지 않게).
    if (line.trim().startsWith("|")) {
      flushList();
      blocks.push(
        <pre key={key++} className="prd-table-raw">
          {line}
        </pre>,
      );
      continue;
    }

    flushList();
    blocks.push(
      <p key={key++} className="prd-paragraph">
        {renderInline(line)}
      </p>,
    );
  }

  flushList();
  return blocks;
}

function PrdSectionView({ section, index }: { section: PrdSection; index: number }): JSX.Element {
  const className = `prd-section${section.empty ? " prd-section--empty" : ""}`;
  return (
    <section className={className} data-testid={`prd-section-${section.key}`}>
      <h3 className="prd-section-title">
        {index + 1}. {section.title}
      </h3>
      <div className="prd-section-body">
        {section.empty ? (
          <p className="prd-empty-note">해당 문서에 없음</p>
        ) : (
          renderMarkdown(section.body)
        )}
      </div>
    </section>
  );
}

export function PrdPanel({ prd }: { prd: Prd }): JSX.Element {
  return (
    <div className="prd-doc" data-testid="prd-doc">
      {prd.sections.map((section, i) => (
        <PrdSectionView key={section.key} section={section} index={i} />
      ))}
    </div>
  );
}
