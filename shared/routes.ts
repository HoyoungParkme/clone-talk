import { z } from "zod";
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
    // Input is FormData, handled separately in implementation
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
      200: z.void() // SSE stream
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
    path: "/api/agent/poll", // Query param: session_id
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
