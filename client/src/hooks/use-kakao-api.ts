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

// Hook for file upload
export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(api.upload.path, {
        method: "POST",
        body: formData, // fetch handles Content-Type for FormData
      });

      if (!res.ok) throw new Error("Upload failed");
      return await res.json() as { job_id: string };
    },
  });
}

// Hook for polling job status
export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      if (!jobId) throw new Error("No job ID");
      const url = buildUrl(api.getJob.path, { job_id: jobId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch job status");
      return api.getJob.responses[200].parse(await res.json());
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 1000;
      // Stop polling if done or error
      if (data.status === "done" || data.status === "error") return false;
      return 1000; // Poll every 1s
    },
  });
}

// Hook for confirming persona
export function useConfirmPersona() {
  return useMutation({
    mutationFn: async (data: { job_id: string; persona_profile: PersonaProfile }) => {
      const res = await fetch(api.confirmPersona.path, {
        method: api.confirmPersona.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to confirm persona");
      return api.confirmPersona.responses[200].parse(await res.json());
    },
  });
}

// Hook for Settings
export function useSettings() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: [api.getSettings.path],
    queryFn: async () => {
      const res = await fetch(api.getSettings.path);
      if (!res.ok) throw new Error("Failed to fetch settings");
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
      if (!res.ok) throw new Error("Failed to update settings");
      return api.updateSettings.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.getSettings.path] });
    },
  });

  return { ...query, update: mutation };
}

// Hook for Agent Polling
export function useAgentPoll(sessionId: string) {
  return useQuery({
    queryKey: ["agent-poll", sessionId],
    queryFn: async () => {
      const res = await fetch(`${api.agentPoll.path}?session_id=${sessionId}`);
      if (!res.ok) throw new Error("Poll failed");
      return api.agentPoll.responses[200].parse(await res.json());
    },
    refetchInterval: 3000, // Poll every 3s
  });
}

// Custom Hook for Chat Streaming (POST + ReadableStream)
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
      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // The backend might send SSE format "data: ...", need to parse or raw?
        // Implementation notes say "SSE handling", but method is POST. 
        // Usually POST streaming returns raw text or ndjson. 
        // Assuming raw text for now based on simple chat requirements, 
        // OR standard SSE format needing parsing.
        
        // Let's assume standard SSE "data: " prefix might be present if using EventSource backend logic
        const lines = chunk.split("\n");
        for (const line of lines) {
            if (line.startsWith("data: ")) {
                const content = line.slice(6);
                // Handle [DONE]
                if (content.trim() === "[DONE]") {
                    continue;
                }
                try {
                    // Try parsing JSON if it's JSON-encoded string
                   const parsed = JSON.parse(content);
                   onChunk(parsed.content || parsed); 
                } catch {
                   // Fallback to raw string
                   onChunk(content);
                }
            } else if (line.trim() !== "") {
                // Raw chunk fallback
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
