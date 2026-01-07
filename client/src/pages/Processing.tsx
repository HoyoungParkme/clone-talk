import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useJobStatus } from "@/hooks/use-kakao-api";
import { Layout } from "@/components/Layout";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export default function Processing() {
  const [match, params] = useRoute("/processing/:id");
  const [_, setLocation] = useLocation();
  const jobId = params?.id || null;
  
  const { data: job, error } = useJobStatus(jobId);

  useEffect(() => {
    if (job?.status === "done") {
        // Add a small delay for user to see 100%
        const timer = setTimeout(() => {
            setLocation(`/review/${jobId}`);
        }, 800);
        return () => clearTimeout(timer);
    }
  }, [job?.status, jobId, setLocation]);

  const progress = job?.progress || 0;
  
  return (
    <Layout showHeader={false} className="bg-slate-50">
      <div className="flex-1 flex flex-col items-center justify-center p-8 max-w-md mx-auto w-full text-center">
        
        {/* Visual State */}
        <div className="mb-8 relative">
            <div className="w-32 h-32 rounded-full bg-white shadow-xl flex items-center justify-center relative z-10">
                {job?.status === "error" ? (
                    <AlertTriangle className="w-12 h-12 text-red-500" />
                ) : job?.status === "done" ? (
                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                ) : (
                    <Loader2 className="w-12 h-12 text-kakao-yellow animate-spin" />
                )}
            </div>
            {/* Pulsing ring behind */}
            {(job?.status === "running" || job?.status === "queued") && (
                <div className="absolute inset-0 bg-kakao-yellow/20 rounded-full animate-ping z-0" />
            )}
        </div>

        {/* Text State */}
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {job?.status === "queued" && "Waiting in queue..."}
            {job?.status === "running" && "Analyzing Chat Patterns..."}
            {job?.status === "done" && "Analysis Complete!"}
            {job?.status === "error" && "Processing Failed"}
        </h2>
        
        <p className="text-slate-500 mb-8 h-6">
            {job?.status === "running" && "Extracting speech styles and topics..."}
            {job?.status === "error" && (job.error || "Unknown error occurred")}
        </p>

        {/* Progress Bar */}
        {job?.status !== "error" && (
            <div className="w-full space-y-2">
                <Progress value={progress} className="h-3 bg-slate-200" />
                <div className="flex justify-between text-xs font-medium text-slate-400">
                    <span>Start</span>
                    <span>{Math.round(progress)}%</span>
                </div>
            </div>
        )}

        {/* Error Action */}
        {job?.status === "error" && (
            <Button 
                onClick={() => setLocation("/")}
                variant="outline"
                className="mt-4"
            >
                Try Again
            </Button>
        )}
      </div>
    </Layout>
  );
}
