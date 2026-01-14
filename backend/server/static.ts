/**
 * 모듈명: backend.server.static
 * 설명: 프로덕션 정적 파일 제공
 *
 * 주요 기능:
 * - 빌드 결과물 정적 서빙
 * - 라우팅 폴백 처리
 *
 * 의존성:
 * - express: 정적 파일 미들웨어
 */

// 1. 표준 라이브러리
import fs from "fs";
import path from "path";

// 2. 서드파티 라이브러리
import express, { type Express } from "express";

/**
 * 프로덕션 정적 파일을 서빙합니다.
 *
 * Args:
 *   app: Express 앱 인스턴스
 */
export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `빌드 디렉터리를 찾을 수 없습니다: ${distPath}. 먼저 클라이언트를 빌드하세요.`,
    );
  }

  app.use(express.static(distPath));

  // 파일이 없으면 index.html로 폴백
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
