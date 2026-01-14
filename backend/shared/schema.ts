/**
 * 모듈명: backend.shared.schema
 * 설명: API 공용 Zod 스키마 정의
 *
 * 주요 기능:
 * - 페르소나/작업/채팅/설정 스키마 정의
 * - 프론트/백엔드 공용 타입 제공
 *
 * 의존성:
 * - zod: 스키마 검증
 */

// 1. 서드파티 라이브러리
import { z } from "zod";

/**
 * 페르소나 프로필 스키마
 */
export const personaProfileSchema = z.object({
  nickname_rules: z.array(z.string()),
  speech_style: z.object({
    endings: z.array(z.string()),
    honorific_level: z.enum(["informal", "polite", "mixed"]),
    emoji_usage: z.enum(["low", "medium", "high"]),
    punctuation: z.enum(["short", "normal", "many"]),
  }),
  favorite_topics: z.array(z.string()),
  taboo_topics: z.array(z.string()),
  response_length: z.enum(["short", "medium", "long"]),
  typical_patterns: z.array(z.string()),
  few_shot_examples: z.array(z.object({
    user: z.string(),
    persona: z.string()
  }))
});
export type PersonaProfile = z.infer<typeof personaProfileSchema>;

/**
 * 페르소나 리포트 스키마
 */
export const personaReportSchema = z.object({
  summary: z.string(),
  profile: personaProfileSchema
});
export type PersonaReport = z.infer<typeof personaReportSchema>;

/**
 * 작업 상태 스키마
 */
export const jobStatusSchema = z.enum([
  "queued",
  "running",
  "awaiting_selection",
  "done",
  "error",
]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

/**
 * 작업 상태 응답 스키마
 */
export const jobResponseSchema = z.object({
  job_id: z.string(),
  status: jobStatusSchema,
  progress: z.number(),
  report: personaReportSchema.optional(),
  error: z.string().optional(),
  speakers: z.array(z.string()).optional(),
  selected_speaker: z.string().optional(),
});
export type JobResponse = z.infer<typeof jobResponseSchema>;

/**
 * 채팅 요청 스키마
 */
export const chatRequestSchema = z.object({
  session_id: z.string(),
  job_id: z.string(),
  message: z.string(),
  agent_enabled: z.boolean(),
  style_mode: z.enum(["prompt", "rag", "hybrid"]).optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * 에이전트 설정 스키마
 */
export const settingsSchema = z.object({
  agent_enabled: z.boolean()
});
export type Settings = z.infer<typeof settingsSchema>;

/**
 * 에이전트 폴링 응답 스키마
 */
export const agentPollResponseSchema = z.object({
  should_send: z.boolean(),
  message: z.string().optional()
});
export type AgentPollResponse = z.infer<typeof agentPollResponseSchema>;

/**
 * API 오류 스키마
 */
export const apiErrorSchema = z.object({
  message: z.string()
});
