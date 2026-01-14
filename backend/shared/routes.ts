/**
 * 모듈명: backend.shared.routes
 * 설명: 프론트/백엔드 공용 API 라우트 정의
 *
 * 주요 기능:
 * - 엔드포인트 경로/스키마 매핑
 * - 타입 안전한 URL 빌드
 *
 * 의존성:
 * - zod: 스키마 검증
 */

// 1. 서드파티 라이브러리
import { z } from "zod";

// 2. 로컬 애플리케이션
import {
  jobResponseSchema,
  personaProfileSchema,
  chatRequestSchema,
  settingsSchema,
  agentPollResponseSchema,
  apiErrorSchema
} from "./schema";

export const api = {
  upload: {
    method: "POST" as const,
    path: "/api/upload",
    // 입력은 FormData이며 구현에서 별도로 처리
    responses: {
      200: z.object({ job_id: z.string() }),
      400: apiErrorSchema
    }
  },
  getJob: {
    method: "GET" as const,
    path: "/api/jobs/:job_id",
    responses: {
      200: jobResponseSchema,
      404: apiErrorSchema
    }
  },
  analyzeJob: {
    method: "POST" as const,
    path: "/api/jobs/:job_id/analyze",
    input: z.object({
      target_speaker: z.string()
    }),
    responses: {
      200: z.object({ ok: z.boolean() }),
      400: apiErrorSchema,
      404: apiErrorSchema
    }
  },
  confirmPersona: {
    method: "POST" as const,
    path: "/api/persona/confirm",
    input: z.object({
      job_id: z.string(),
      persona_profile: personaProfileSchema
    }),
    responses: {
      200: z.object({ ok: z.boolean() }),
      400: apiErrorSchema
    }
  },
  chatStream: {
    method: "POST" as const,
    path: "/api/chat/stream",
    input: chatRequestSchema,
    responses: {
      200: z.void() // SSE 스트림
    }
  },
  getSettings: {
    method: "GET" as const,
    path: "/api/settings",
    responses: {
      200: settingsSchema
    }
  },
  updateSettings: {
    method: "POST" as const,
    path: "/api/settings",
    input: settingsSchema,
    responses: {
      200: settingsSchema
    }
  },
  agentPoll: {
    method: "GET" as const,
    path: "/api/agent/poll", // 쿼리 파라미터: session_id
    responses: {
      200: agentPollResponseSchema
    }
  },
  health: {
    method: "GET" as const,
    path: "/api/health",
    responses: {
      200: z.object({ ok: z.boolean() })
    }
  }
};

/**
 * 경로 파라미터를 치환해 URL을 생성합니다.
 *
 * Args:
 *   path: 경로 템플릿
 *   params: 치환할 파라미터 맵
 *
 * Returns:
 *   string: 완성된 URL
 */
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
