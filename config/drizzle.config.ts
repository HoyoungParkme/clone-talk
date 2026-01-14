/**
 * 모듈명: config.drizzle
 * 설명: Drizzle 마이그레이션 설정
 *
 * 주요 기능:
 * - 마이그레이션 산출물 경로 지정
 * - 스키마 파일 경로 지정
 * - 데이터베이스 연결 정보 구성
 *
 * 의존성:
 * - drizzle-kit
 */

// 1. 표준 라이브러리
import path from "path";
import { fileURLToPath } from "url";

// 2. 서드파티 라이브러리
import { defineConfig } from "drizzle-kit";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(configDir, "..");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL이 필요합니다. 데이터베이스 준비 여부를 확인하세요.");
}

/**
 * Drizzle 설정 객체를 반환합니다.
 */
export default defineConfig({
  out: path.resolve(rootDir, "migrations"),
  schema: path.resolve(rootDir, "backend/shared/schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
