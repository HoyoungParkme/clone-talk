import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useJobStatus, useAnalyzePersona } from "@/hooks/use-kakao-api";
import { Loader2, Users, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SpeakerSelect() {
  const [match, params] = useRoute("/select/:id");
  const [_, setLocation] = useLocation();
  const jobId = params?.id || null;

  const [analysisRequested, setAnalysisRequested] = useState(false);
  const { data: job, isLoading } = useJobStatus(jobId, analysisRequested);
  const { mutate: analyze, isPending } = useAnalyzePersona();
  const { toast } = useToast();
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (job?.speakers?.length && !selected) {
      setSelected(job.speakers[0]);
    }
  }, [job, selected]);

  useEffect(() => {
    if (!analysisRequested || !jobId) return;
    if (job?.status === "done") {
      setLocation(`/review/${jobId}`);
      return;
    }
    if (job?.status === "error") {
      toast({
        title: "분석 실패",
        description: job.error || "분석 중 오류가 발생했습니다",
        variant: "destructive",
      });
      setAnalysisRequested(false);
    }
  }, [analysisRequested, job?.status, job?.error, jobId, setLocation, toast]);

  if (isLoading || !jobId) {
    return (
      <Layout showHeader={false}>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-kakao-yellow" />
        </div>
      </Layout>
    );
  }

  if (job?.status === "error") {
    return (
      <Layout title="화자 선택">
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
          <p className="text-sm text-slate-600">{job.error || "오류가 발생했습니다"}</p>
          <Button variant="outline" onClick={() => setLocation("/")}>다시 시도</Button>
        </div>
      </Layout>
    );
  }

  const speakers = job?.speakers ?? [];

  const handleStart = () => {
    if (!jobId || !selected || analysisRequested) return;
    setAnalysisRequested(true);
    analyze(
      { job_id: jobId, target_speaker: selected },
      {
        onError: (err: any) => {
          toast({
            title: "분석 시작 실패",
            description: err?.message || "요청 처리에 실패했습니다",
            variant: "destructive",
          });
          setAnalysisRequested(false);
        },
      }
    );
  };

  return (
    <Layout title="Memory Talk" className="bg-slate-50">
      <div className="flex-1 p-6 space-y-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-kakao-yellow/20 flex items-center justify-center">
            <Users className="w-5 h-5 text-kakao-brown" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">이야기할 사람을 선택하세요</p>
            <p className="text-xs text-slate-500">선택한 사람의 말투로 분석합니다</p>
          </div>
        </Card>

        <div className="space-y-2">
          {speakers.length === 0 && (
            <p className="text-sm text-slate-500">참여자를 찾지 못했습니다.</p>
          )}
          {speakers.map((speaker) => (
            <button
              key={speaker}
              type="button"
              onClick={() => setSelected(speaker)}
              disabled={isPending || analysisRequested}
              aria-pressed={selected === speaker}
              className={`w-full text-left px-4 py-3 rounded-xl border transition relative flex items-center justify-between disabled:opacity-60 disabled:pointer-events-none ${
                selected === speaker
                  ? "border-kakao-brown bg-kakao-yellow text-kakao-brown font-bold ring-2 ring-kakao-brown/40"
                  : "border-slate-200 bg-white text-slate-700"
              }`}
            >
              <span className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-kakao-brown/80" style={{ opacity: selected === speaker ? 1 : 0 }} />
              <span className="pl-2">{speaker}</span>
              <CheckCircle2 className={`w-4 h-4 ${selected === speaker ? "text-kakao-brown" : "text-transparent"}`} />
            </button>
          ))}
        </div>

        <Button
          onClick={handleStart}
          disabled={!selected || isPending || analysisRequested}
          className="w-full bg-kakao-yellow text-kakao-brown hover:bg-kakao-yellow/90 font-bold"
        >
          {(isPending || analysisRequested) ? "분석 중..." : "선택 완료"}
        </Button>
      </div>
    </Layout>
  );
}
