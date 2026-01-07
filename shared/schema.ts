import { z } from "zod";

// Persona Profile Schema
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

// Report Schema
export const personaReportSchema = z.object({
  summary: z.string(),
  profile: personaProfileSchema
});
export type PersonaReport = z.infer<typeof personaReportSchema>;

// Job Status
export const jobStatusSchema = z.enum(["queued", "running", "done", "error"]);
export type JobStatus = z.infer<typeof jobStatusSchema>;

export const jobResponseSchema = z.object({
  job_id: z.string(),
  status: jobStatusSchema,
  progress: z.number(),
  report: personaReportSchema.optional(),
  error: z.string().optional()
});
export type JobResponse = z.infer<typeof jobResponseSchema>;

// Chat
export const chatRequestSchema = z.object({
  session_id: z.string(),
  message: z.string(),
  agent_enabled: z.boolean()
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

// Settings
export const settingsSchema = z.object({
  agent_enabled: z.boolean()
});
export type Settings = z.infer<typeof settingsSchema>;

// Agent Poll
export const agentPollResponseSchema = z.object({
  should_send: z.boolean(),
  message: z.string().optional()
});
export type AgentPollResponse = z.infer<typeof agentPollResponseSchema>;

// API Error
export const apiErrorSchema = z.object({
  message: z.string()
});
