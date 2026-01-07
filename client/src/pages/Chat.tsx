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
  
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const { sendMessage, isLoading: isStreaming } = useChatStream();
  const { data: agentPoll } = useAgentPoll(sessionId);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  // Handle polled agent messages (proactive messages)
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
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const userMsg = input.trim();
    setInput("");
    addMessage(userMsg, true);

    // Prepare placeholder for streaming response
    const botMsgId = uuidv4();
    setMessages(prev => [...prev, {
        id: botMsgId,
        text: "...", // Loading state
        isUser: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);

    let fullText = "";

    await sendMessage(
        { session_id: sessionId, message: userMsg, agent_enabled: true },
        (chunk) => {
            fullText += chunk;
            setMessages(prev => prev.map(m => 
                m.id === botMsgId ? { ...m, text: fullText } : m
            ));
        },
        () => {
            // Completed
        },
        (err) => {
            setMessages(prev => prev.map(m => 
                m.id === botMsgId ? { ...m, text: "Error: " + err.message } : m
            ));
        }
    );
  };

  return (
    <Layout 
        title="Persona Chat" 
        className="bg-kakao-bg"
        action={<Button variant="ghost" size="icon" className="text-foreground"><MoreVertical className="w-5 h-5" /></Button>}
    >
        {/* Messages Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 flex flex-col">
            {/* Welcome Date Divider */}
            <div className="flex justify-center mb-6">
                <div className="bg-black/10 text-white text-[10px] px-3 py-1 rounded-full backdrop-blur-sm">
                    {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
            </div>

            {/* Empty State */}
            {messages.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center opacity-40">
                    <p className="text-sm text-slate-600">Start the conversation!</p>
                </div>
            )}

            {messages.map((msg) => (
                <ChatBubble 
                    key={msg.id}
                    message={msg.text}
                    isUser={msg.isUser}
                    timestamp={msg.timestamp}
                    name={!msg.isUser ? "Persona" : undefined}
                />
            ))}
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-slate-100">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <div className="flex-1 relative">
                    <Input 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Type a message..."
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
