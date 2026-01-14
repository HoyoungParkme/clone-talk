/**
 * 모듈명: backend.script.build
 * 설명: 프론트/서버 빌드 스크립트
 *
 * 주요 기능:
 * - Vite로 클라이언트 빌드
 * - esbuild로 서버 번들링
 * - 빌드 산출물 정리
 *
 * 의존성:
 * - vite: 프론트 빌드
 * - esbuild: 서버 번들링
 */

// 1. 표준 라이브러리
import { rm, readFile } from "fs/promises";
import path from "path";

// 2. 서드파티 라이브러리
import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";

// openat(2) 호출을 줄이기 위해 서버 의존성을 번들링
// 콜드 스타트 시간을 개선
const allowlist = [
  "@google/generative-ai",
  "axios",
  "connect-pg-simple",
  "cors",
  "date-fns",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-rate-limit",
  "express-session",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nanoid",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "pg",
  "stripe",
  "uuid",
  "ws",
  "xlsx",
  "zod",
  "zod-validation-error",
];

/**
 * 클라이언트/서버 빌드를 순차 실행합니다.
 *
 * Returns:
 *   Promise<void>
 */
async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("클라이언트 빌드 중...");
  await viteBuild({
    configFile: path.resolve(process.cwd(), "config/vite.config.ts"),
  });

  console.log("서버 빌드 중...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["backend/server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    external: externals,
    logLevel: "info",
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
