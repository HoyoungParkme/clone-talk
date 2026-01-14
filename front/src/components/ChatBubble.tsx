import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface ChatBubbleProps {
  message: string;
  isUser: boolean;
  timestamp?: string;
  avatarUrl?: string;
  name?: string;
}

export function ChatBubble({ message, isUser, timestamp, avatarUrl, name }: ChatBubbleProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex w-full mb-4 px-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex-shrink-0 mr-2 mt-1 flex flex-col items-center gap-1">
           <div className="w-10 h-10 rounded-[14px] bg-slate-200 overflow-hidden border border-slate-100 shadow-sm">
            {avatarUrl ? (
                <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
                </div>
            )}
           </div>
        </div>
      )}

      <div className={cn("flex flex-col max-w-[70%]", isUser ? "items-end" : "items-start")}>
        {!isUser && name && (
            <span className="text-xs text-slate-500 mb-1 ml-1">{name}</span>
        )}
        
        <div className="flex items-end gap-1.5">
          {isUser && timestamp && (
             <span className="text-[10px] text-slate-500 mb-1 min-w-fit">{timestamp}</span>
          )}

          <div
            className={cn(
              "px-4 py-2 text-[15px] leading-relaxed shadow-sm break-words whitespace-pre-wrap",
              isUser 
                ? "bg-kakao-yellow text-kakao-brown rounded-2xl rounded-tr-md" 
                : "bg-white text-foreground rounded-2xl rounded-tl-md border border-slate-100"
            )}
          >
            {message}
          </div>

          {!isUser && timestamp && (
             <span className="text-[10px] text-slate-500 mb-1 min-w-fit">{timestamp}</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
