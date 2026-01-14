import { useState, useRef, useEffect } from "react";
import { useRoute } from "wouter";
import { useChatStream, useAgentPoll, useJobStatus } from "@/hooks/use-kakao-api";
import { Layout } from "@/components/Layout";
import { ChatBubble } from "@/components/ChatBubble";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowUp, Loader2, MoreVertical } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: string;
}

export default function Chat() {
  const [match, params] = useRoute("/chat/:jobId");
  const jobId = params?.jobId || "demo";
  const [sessionId] = useState(() => uuidv4());
  const [styleMode, setStyleMode] = useState<"prompt" | "rag" | "hybrid">("hybrid");
  
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { sendMessage, isLoading: isStreaming } = useChatStream();
  const { data: agentPoll } = useAgentPoll(sessionId);
  const { data: job } = useJobStatus(jobId);
  const personaName = job?.selected_speaker || "페르소나";

  // 새 메시지마다 하단으로 스크롤
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // 에이전트 폴링 메시지 처리(선제 메시지)
  useEffect(() => {
    if (agentPoll?.should_send && agentPoll.message) {
        addMessage(agentPoll.message, false);
    }
  }, [agentPoll]);

  const addMessage = (text: string, isUser: boolean) => {
    setMessages(prev => [...prev, {
        id: uuidv4(),
        text,
        isUser,
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    }]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMsg = input.trim();
    setInput("");
    addMessage(userMsg, true);

    // 스트리밍 응답 자리표시
    const botMsgId = uuidv4();
    setMessages(prev => [...prev, {
        id: botMsgId,
        text: "...", // 로딩 상태
        isUser: false,
        timestamp: new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
    }]);

    let fullText = "";

    await sendMessage(
        { session_id: sessionId, job_id: jobId, message: userMsg, agent_enabled: true, style_mode: styleMode },
        (chunk) => {
            fullText += chunk;
            setMessages(prev => prev.map(m => 
                m.id === botMsgId ? { ...m, text: fullText } : m
            ));
        },
        () => {
            // 완료
        },
        (err) => {
            setMessages(prev => prev.map(m => 
                m.id === botMsgId ? { ...m, text: "오류: " + err.message } : m
            ));
        }
    );
  };

  return (
    <Layout 
        title={`${personaName} 채팅`} 
        className="bg-kakao-bg"
        action={<Button variant="ghost" size="icon" className="text-foreground"><MoreVertical className="w-5 h-5" /></Button>}
    >
        {/* 메시지 영역 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
            {/* 날짜 구분선 */}
            <div className="flex justify-center mb-6">
                <div className="bg-black/10 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm">
                    {new Date().toLocaleDateString("ko-KR", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                </div>
            </div>

            {/* 빈 상태 */}
            {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                    <p className="text-sm text-slate-600">대화를 시작해 보세요!</p>
                </div>
            )}

            {messages.map((msg) => (
                <ChatBubble 
                    key={msg.id}
                    message={msg.text}
                    isUser={msg.isUser}
                    timestamp={msg.timestamp}
                    name={!msg.isUser ? personaName : undefined}
                />
            ))}
        </div>

        {/* 입력 영역 */}
        <div className="p-3 bg-white border-t border-slate-100">
            <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] text-slate-500">스타일 모드</span>
                {[
                    { key: "prompt", label: "프롬프트" },
                    { key: "rag", label: "RAG" },
                    { key: "hybrid", label: "혼합" }
                ].map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        onClick={() => setStyleMode(item.key as "prompt" | "rag" | "hybrid")}
                        aria-pressed={styleMode === item.key}
                        className={`text-[11px] px-2 py-1 rounded-full border transition ${
                            styleMode === item.key
                              ? "bg-kakao-yellow text-kakao-brown border-kakao-brown"
                              : "bg-white text-slate-500 border-slate-200"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <div className="flex-1 relative">
                    <Input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="메시지를 입력하세요..."
                        className="pr-10 bg-slate-100 border-none focus-visible:ring-1 focus-visible:ring-kakao-yellow/50 rounded-[20px]"
                    />
                </div>
                <Button 
                    type="submit" 
                    disabled={!input.trim() || isStreaming}
                    className="bg-kakao-yellow hover:bg-kakao-yellow/90 text-kakao-brown rounded-[20px] w-12 px-0"
                >
                    {isStreaming ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <ArrowUp className="w-5 h-5 font-bold" />
                    )}
                </Button>
            </form>
        </div>
    </Layout>
  );
}
