import { useState } from "react";
import { useUploadFile } from "@/hooks/use-kakao-api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Upload, MessageCircle, FileText, AlertCircle, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const { mutate: uploadFile, isPending } = useUploadFile();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const handleFile = (file: File) => {
    if (file.type !== "text/plain" && !file.name.endsWith(".txt")) {
      toast({
        title: "지원하지 않는 파일 형식",
        description: ".txt 파일만 업로드해 주세요",
        variant: "destructive"
      });
      return;
    }

    uploadFile(file, {
      onSuccess: (data) => {
        setLocation(`/processing/${data.job_id}`);
      },
      onError: (err) => {
        toast({
          title: "업로드 실패",
          description: err.message,
          variant: "destructive"
        });
      }
    });
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <Layout 
      showHeader={false} 
      className="bg-kakao-yellow"
    >
      <div className="flex-1 flex flex-col justify-center px-6 relative">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12 text-center"
        >
          <div className="w-20 h-20 bg-kakao-brown rounded-[2rem] mx-auto mb-6 flex items-center justify-center shadow-lg transform -rotate-6">
            <MessageCircle className="w-10 h-10 text-kakao-yellow" />
          </div>
          <h1 className="text-3xl font-extrabold text-kakao-brown mb-2 font-display">
            Memory Talk 
          </h1>
          <p className="text-kakao-brown/70 font-medium">
            그리운 사람과 다시 대화해요
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
            <div 
            className={`
                relative group cursor-pointer
                bg-white/90 backdrop-blur rounded-3xl p-8 
                border-2 border-dashed transition-all duration-300
                flex flex-col items-center justify-center gap-4
                shadow-xl shadow-kakao-brown/5
                ${isDragging ? 'border-kakao-brown bg-white scale-[1.02]' : 'border-transparent hover:scale-[1.01]'}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={onDrop}
            onClick={() => document.getElementById('file-input')?.click()}
            >
            <input 
                id="file-input" 
                type="file" 
                accept=".txt" 
                className="hidden" 
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            
            <div className={`
                w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center
                transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12
            `}>
                {isPending ? (
                 <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-kakao-brown" />
                ) : (
                 <Upload className="w-8 h-8 text-slate-400 group-hover:text-kakao-brown transition-colors" />
                )}
            </div>

            <div className="text-center">
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-kakao-brown transition-colors">
                {isPending ? "분석 중..." : "업로드하려면 탭하세요"}
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                또는 .txt 파일을 끌어다 놓으세요
                </p>
            </div>
            </div>
        </motion.div>

        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 flex items-start gap-3 p-4 bg-white/20 rounded-2xl border border-kakao-brown/5"
        >
            <AlertCircle className="w-5 h-5 text-kakao-brown shrink-0 mt-0.5" />
            <p className="text-xs text-kakao-brown/80 leading-relaxed font-medium">
                <strong>개인정보 안내:</strong> 원본 파일은 처리 직후 영구 삭제되며, 추출된 페르소나 프로필만 저장됩니다.
            </p>
        </motion.div>
      </div>
    </Layout>
  );
}
