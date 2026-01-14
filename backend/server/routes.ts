/**
 * 모듈명: backend.server.routes
 * 설명: Express 라우트 및 프록시 설정
 *
 * 주요 기능:
 * - /api 요청을 FastAPI로 프록시
 *
 * 의존성:
 * - http-proxy-middleware: API 프록시
 */

// 1. 표준 라이브러리
import { type Server } from "http";

// 2. 서드파티 라이브러리
import type { Express } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

/**
 * API 프록시 라우트를 등록합니다.
 *
 * Args:
 *   httpServer: HTTP 서버 인스턴스
 *   app: Express 앱 인스턴스
 *
 * Returns:
 *   Server: HTTP 서버
 */
export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // /api 요청을 8000 포트의 파이썬 백엔드로 프록시
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://127.0.0.1:8000",
      changeOrigin: true,
      pathRewrite: {
        "^/api": "",
      },
      logLevel: "debug" 
    })
  );

  return httpServer;
}
