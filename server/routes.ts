import type { Express } from "express";
import { createServer, type Server } from "http";
import { createProxyMiddleware } from "http-proxy-middleware";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Proxy /api requests to Python backend running on port 8000
  app.use(
    "/api",
    createProxyMiddleware({
      target: "http://0.0.0.0:8000",
      changeOrigin: true,
      logLevel: "debug" 
    })
  );

  return httpServer;
}
