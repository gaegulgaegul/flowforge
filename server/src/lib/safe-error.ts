/** 내부 에러를 클라이언트에 노출하지 않는 안전 래퍼 (wowa-app/server 패턴) */
import type { Request, Response, NextFunction } from "express";

export type AsyncHandler = (req: Request, res: Response) => Promise<void>;

/** async 핸들러의 throw를 잡아 500 + 안전 메시지로 변환. 상세는 서버 로그에만. */
export function safe(handler: AsyncHandler) {
  return (req: Request, res: Response, _next: NextFunction): void => {
    handler(req, res).catch((err: unknown) => {
      const detail = err instanceof Error ? err.message : String(err);
      process.stderr.write(`[flowforge] ${req.method} ${req.path} 실패: ${detail}\n`);
      if (!res.headersSent) {
        res.status(500).json({ error: "internal_error" });
      }
    });
  };
}
