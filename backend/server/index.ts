/**
 * 모듈명: backend.server.index
 * 설명: Express 서버 초기화 및 FastAPI 프로세스 실행
 *
 * 주요 기능:
 * - Express 서버 부팅 및 라우트 등록
 * - FastAPI(Uvicorn) 서브 프로세스 실행
 * - 개발/프로덕션 정적 리소스 제공
 *
 * 의존성:
 * - express: HTTP 서버
 * - http-proxy-middleware: API 프록시
 * - tsx: 개발 환경 TypeScript 실행
 */

// 1. 표준 라이브러리
import { spawn } from "child_process";
import fs from "fs";
import { createServer } from "http";
import path from "path";

// 2. 서드파티 라이브러리
import express, { type Request, Response, NextFunction } from "express";

// 3. 로컬 애플리케이션
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";

const app = express();
const httpServer = createServer(app);

const rootDir = process.cwd();
const isWindows = process.platform === "win32";
const venvPython = isWindows
  ? path.join(rootDir, ".venv", "Scripts", "python.exe")
  : path.join(rootDir, ".venv", "bin", "python");
const pythonCommand = process.env.PYTHON_CMD
  || (fs.existsSync(venvPython) ? venvPython : "python");
const pythonPath = [
  rootDir,
  process.env.PYTHONPATH,
].filter(Boolean).join(path.delimiter);
const pythonArgs = [
  "-B",
  "-m",
  "uvicorn",
  "backend.main:app",
  "--host",
  "0.0.0.0",
  "--port",
  "8000",
  "--reload",
];

const pythonProcess = spawn(pythonCommand, pythonArgs, {
  stdio: "inherit",
  shell: true,
  cwd: rootDir,
  env: {
    ...process.env,
    PYTHONPATH: pythonPath,
  },
});

pythonProcess.on('error', (err) => {
  console.error('파이썬 백엔드 시작 실패:', err);
});

process.on('exit', () => {
  pythonProcess.kill();
});

/**
 * 서버 로그를 일관된 포맷으로 출력합니다.
 *
 * Args:
 *   message: 로그 메시지
 *   source: 로그 소스 식별자
 */
export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} ${duration}ms 소요`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "서버 내부 오류";

    res.status(status).json({ message });
    throw err;
  });

  // 개발 환경에서만 Vite를 설정하고, 라우팅 등록 이후에 수행
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // PORT 환경 변수로 지정된 포트에서만 앱을 실행(기본값 5000)
  // 해당 포트는 API와 클라이언트를 함께 제공
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || (isWindows ? "127.0.0.1" : "0.0.0.0");
  httpServer.listen(
    {
      port,
      host,
      reusePort: !isWindows,
    },
    () => {
      log(`포트 ${port}에서 서버 실행`);
    },
  );
})();
