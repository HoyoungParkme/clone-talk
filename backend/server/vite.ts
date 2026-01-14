/**
 * 모듈명: backend.server.vite
 * 설명: 개발 모드 Vite 미들웨어 설정
 *
 * 주요 기능:
 * - Vite 개발 서버를 미들웨어로 연결
 * - index.html 변환 및 HMR 지원
 *
 * 의존성:
 * - vite: 개발 서버
 * - nanoid: 캐시 무효화용 ID 생성
 */

// 1. 표준 라이브러리
import fs from "fs";
import { type Server } from "http";
import path from "path";

// 2. 서드파티 라이브러리
import { type Express } from "express";
import { nanoid } from "nanoid";
import { createServer as createViteServer, createLogger } from "vite";

// 3. 로컬 애플리케이션
import viteConfig from "../../config/vite.config";

const viteLogger = createLogger();

/**
 * Vite 개발 미들웨어를 설정합니다.
 *
 * Args:
 *   server: HTTP 서버
 *   app: Express 앱
 */
export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "..",
        "front",
        "index.html",
      );

      // index.html 변경을 반영하기 위해 매번 디스크에서 다시 로드
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}
