/** vitest + jest-dom 매처 타입 등록(flowforge-screen-crosslink).
 * 이 side-effect import가 vitest의 Assertion 인터페이스에 toBeInTheDocument/toHaveTextContent 등을
 * augment한다 — tsc가 컴포넌트 테스트에서 그 매처를 인식하게 한다(런타임 등록은 vitest.setup.ts). */
import "@testing-library/jest-dom/vitest";
