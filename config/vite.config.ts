/**
 * 모듈명: config.vite
 * 설명: Vite 개발/빌드 설정
 *
 * 주요 기능:
 * - React/Vite 플러그인 구성
 * - alias/root/build/css 설정
 * - 개발 서버 파일 접근 제한
 *
 * 의존성:
 * - vite
 * - @vitejs/plugin-react
 * - tailwindcss, autoprefixer
 */

// 1. 표준 라이브러리
import path from "path";

// 2. 서드파티 라이브러리
import autoprefixer from "autoprefixer";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import react from "@vitejs/plugin-react";
import tailwindcss from "tailwindcss";
import { defineConfig } from "vite";

const configDir = import.meta.dirname;
const rootDir = path.resolve(configDir, "..");
const tailwindConfig = path.resolve(configDir, "tailwind.config.ts");

/**
 * Vite 설정을 반환합니다.
 */
export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "front", "src"),
      "@shared": path.resolve(rootDir, "backend", "shared"),
    },
  },
  root: path.resolve(rootDir, "front"),
  build: {
    outDir: path.resolve(rootDir, "dist/public"),
    emptyOutDir: true,
  },
  css: {
    postcss: {
      plugins: [tailwindcss({ config: tailwindConfig }), autoprefixer()],
    },
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
