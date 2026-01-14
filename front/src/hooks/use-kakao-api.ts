import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { 
  type JobResponse, 
  type PersonaProfile, 
  type ChatRequest,
  type Settings,
  type AgentPollResponse
} from "@shared/schema";
import { useState, useCallback, useRef } from "react";

// 파일 업로드 훅
export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(api.upload.path, {
        method: "POST",
        body: formData, // FormData의 Content-Type은 fetch가 자동 처리
      });

      if (!res.ok) throw new Error("업로드 실패");
      return await res.json() as { job_id: string };
    },
  });
}

// 작업 상태 폴링 훅
export function useJobStatus(jobId: string | null, forcePolling: boolean = false) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("작업 ID가 없습니다");
      const url = buildUrl(api.getJob.path, { job_id: jobId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("작업 상태 조회 실패");
      const text = await res.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch (err) {
        console.error("작업 응답 JSON이 올바르지 않습니다", err, text);
        return normalizeJobResponse(
          { job_id: jobId, status: "error", progress: 0, error: "올바르지 않은 JSON 응답" },
          jobId,
        );
      }
      const parsed = api.getJob.responses[200].safeParse(raw);
      if (parsed.success) {
        return parsed.data;
      }
      console.error("작업 응답 파싱 실패", parsed.error, raw);
      return normalizeJobResponse(raw, jobId);
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000;
      // 완료 또는 오류 상태면 폴링 중지
      if (
        !forcePolling && (
          data.status === "done" ||
          data.status === "error" ||
          data.status === "awaiting_selection"
        )
      ) {
          return false;
      }
      return 3000; // 부하 감소를 위해 3초로 증가
    },
    staleTime: 5000,
    gcTime: 10000,
    retry: 1,
  });
}

const toArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === "string") return [value];
  return [];
};

const normalizeEnum = (
  value: unknown,
  allowed: Set<string>,
  fallback: string,
) => (typeof value === "string" && allowed.has(value) ? value : fallback);

const normalizeSpeechStyle = (value: unknown): PersonaProfile["speech_style"] => {
  const style = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    endings: toArray(style.endings),
    honorific_level: normalizeEnum(style.honorific_level, new Set(["informal", "polite", "mixed"]), "mixed"),
    emoji_usage: normalizeEnum(style.emoji_usage, new Set(["low", "medium", "high"]), "medium"),
    punctuation: normalizeEnum(style.punctuation, new Set(["short", "normal", "many"]), "normal"),
  };
};

const normalizeProfile = (value: unknown): PersonaProfile => {
  const profile = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    nickname_rules: toArray(profile.nickname_rules),
    speech_style: normalizeSpeechStyle(profile.speech_style),
    favorite_topics: toArray(profile.favorite_topics),
    taboo_topics: toArray(profile.taboo_topics),
    response_length: normalizeEnum(profile.response_length, new Set(["short", "medium", "long"]), "medium"),
    typical_patterns: toArray(profile.typical_patterns),
    few_shot_examples: Array.isArray(profile.few_shot_examples)
      ? profile.few_shot_examples
          .filter((item) => item && typeof item === "object" && "user" in item && "persona" in item)
          .map((item) => ({
            user: String((item as Record<string, unknown>).user),
            persona: String((item as Record<string, unknown>).persona),
          }))
      : [],
  };
};

const normalizeJobResponse = (raw: unknown, jobId: string | null): JobResponse => {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const report = data.report && typeof data.report === "object"
    ? {
        summary: typeof (data.report as Record<string, unknown>).summary === "string"
          ? (data.report as Record<string, unknown>).summary as string
          : "",
        profile: normalizeProfile((data.report as Record<string, unknown>).profile),
      }
    : undefined;
  return {
    job_id: typeof data.job_id === "string" ? data.job_id : (jobId ?? ""),
    status: normalizeEnum(
      data.status,
      new Set(["queued", "running", "awaiting_selection", "done", "error"]),
      "error"
    ) as JobResponse["status"],
    progress: typeof data.progress === "number" ? data.progress : 0,
    report,
    error: typeof data.error === "string" ? data.error : undefined,
    speakers: Array.isArray(data.speakers)
      ? data.speakers.filter(Boolean).map(String)
      : undefined,
    selected_speaker: typeof data.selected_speaker === "string"
      ? data.selected_speaker
      : undefined,
  };
};

// 페르소나 확정 훅
export function useConfirmPersona() {
  return useMutation({
    mutationFn: async (data: { job_id: string; persona_profile: PersonaProfile }) => {
      const res = await fetch(api.confirmPersona.path, {
        method: api.confirmPersona.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("페르소나 확정 실패");
      return api.confirmPersona.responses[200].parse(await res.json());
    },
  });
}

// 분석 시작 훅
export function useAnalyzePersona() {
  return useMutation({
    mutationFn: async (data: { job_id: string; target_speaker: string }) => {
      const url = buildUrl(api.analyzeJob.path, { job_id: data.job_id });
      const res = await fetch(url, {
        method: api.analyzeJob.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_speaker: data.target_speaker }),
      });
      if (!res.ok) throw new Error("분석 시작 실패");
      return api.analyzeJob.responses[200].parse(await res.json());
    },
  });
}

// 설정 훅
export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [api.getSettings.path],
    queryFn: async () => {
      const res = await fetch(api.getSettings.path);
      if (!res.ok) throw new Error("설정 조회 실패");
      return api.getSettings.responses[200].parse(await res.json());
    },
  });

  const mutation = useMutation({
    mutationFn: async (settings: Settings) => {
      const res = await fetch(api.updateSettings.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("설정 업데이트 실패");
      return api.updateSettings.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.getSettings.path] });
    },
  });

  return { ...query, update: mutation };
}

// 에이전트 폴링 훅
export function useAgentPoll(sessionId: string) {
  return useQuery({
    queryKey: ["agent-poll", sessionId],
    queryFn: async () => {
      const res = await fetch(`${api.agentPoll.path}?session_id=${sessionId}`);
      if (!res.ok) throw new Error("폴링 실패");
      return api.agentPoll.responses[200].parse(await res.json());
    },
    refetchInterval: 3000, // 3초마다 폴링
  });
}

// 채팅 스트리밍 훅(POST + ReadableStream)
export function useChatStream() {
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (
    data: ChatRequest, 
    onChunk: (chunk: string) => void,
    onComplete: () => void,
    onError: (err: any) => void
  ) => {
    try {
      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      const res = await fetch(api.chatStream.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) throw new Error(res.statusText);
      if (!res.body) throw new Error("응답 본문이 없습니다");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // 백엔드가 SSE 형식("data: ...")을 보낼 수 있으므로 파싱 처리
        
        const lines = chunk.split("\n");
        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const content = line.slice(6);
                // [DONE] 처리
                if (content.trim() === "[DONE]") {
                    continue;
                }
                try {
                   const parsed = JSON.parse(content);
                   if (parsed?.done) {
                     continue;
                   }
                   if (parsed?.error) {
                     onError(new Error(parsed.error));
                     return;
                   }
                   const text = parsed?.text ?? parsed?.content;
                   if (typeof text === "string") {
                     onChunk(text);
                   }
                } catch {
                   // 파싱 실패 시 원문 출력
                   onChunk(content);
                }
            } else if (line.trim() !== "") {
                // 원문 청크 출력
                 onChunk(line);
            }
        }
      }
      onComplete();
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      onError(err);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsLoading(false);
    }
  }, []);

  return { sendMessage, isLoading, stop };
}
