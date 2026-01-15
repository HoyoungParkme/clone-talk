import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useJobStatus, useConfirmPersona } from "@/hooks/use-kakao-api";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Save, ArrowLeft } from "lucide-react";
import { PersonaProfile } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Review() {
  const [match, params] = useRoute("/review/:id");
  const [_, setLocation] = useLocation();
  const jobId = params?.id || null;
  
  const { data: job, isLoading } = useJobStatus(jobId);
  const { mutate: confirm, isPending: isConfirming } = useConfirmPersona();
  const { toast } = useToast();

  // 편집을 위한 로컬 상태
  const [profile, setProfile] = useState<PersonaProfile | null>(null);

  // 작업 데이터 도착 시 프로필 로드
  useEffect(() => {
    if (job?.report?.profile && !profile) {
        setProfile(job.report.profile);
    }
  }, [job]);

  if (isLoading || !profile) {
    return (
        <Layout showHeader={false}>
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-kakao-yellow" />
            </div>
        </Layout>
    );
  }

  const handleSave = () => {
    if (!jobId || !profile) return;
    confirm({ job_id: jobId, persona_profile: profile }, {
        onSuccess: () => setLocation(`/chat/${jobId}`),
        onError: (err: any) => {
            toast({
                title: "채팅 시작 실패",
                description: err?.message || "페르소나 확정 요청에 실패했습니다",
                variant: "destructive"
            });
        }
    });
  };

  const updateProfile = (key: keyof PersonaProfile, value: any) => {
    setProfile(prev => prev ? ({ ...prev, [key]: value }) : null);
  };

  return (
    <Layout 
        title="Memory Talk" 
        className="bg-slate-50"
        action={
            <Button 
                size="sm" 
                onClick={handleSave} 
                disabled={isConfirming}
                className="bg-kakao-yellow text-kakao-brown hover:bg-kakao-yellow/90 font-bold rounded-full px-4"
            >
                {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : "채팅 시작"}
            </Button>
        }
    >
      <ScrollArea className="flex-1 p-6">
        <div className="space-y-6 pb-20">
            
            {/* 요약 카드 */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-2 font-display">분석 요약</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                    {job?.report?.summary}
                </p>
            </div>

            {/* 말투 */}
            <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">말투</Label>
                <Card className="p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label className="text-xs text-slate-500">존댓말 수준</Label>
                            <select 
                                className="w-full text-sm mt-1 p-2 rounded-md border bg-slate-50"
                                value={profile.speech_style.honorific_level}
                                onChange={e => setProfile({...profile, speech_style: {...profile.speech_style, honorific_level: e.target.value as any}})}
                            >
                                <option value="informal">반말</option>
                                <option value="polite">존댓말</option>
                                <option value="mixed">혼합</option>
                            </select>
                        </div>
                        <div>
                            <Label className="text-xs text-slate-500">이모지 사용량</Label>
                            <select 
                                className="w-full text-sm mt-1 p-2 rounded-md border bg-slate-50"
                                value={profile.speech_style.emoji_usage}
                                onChange={e => setProfile({...profile, speech_style: {...profile.speech_style, emoji_usage: e.target.value as any}})}
                            >
                                <option value="low">낮음</option>
                                <option value="medium">보통</option>
                                <option value="high">높음</option>
                            </select>
                        </div>
                    </div>
                </Card>
            </div>

            {/* 호칭 규칙 */}
            <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">호칭 규칙</Label>
                <div className="flex flex-wrap gap-2">
                    {profile.nickname_rules.map((rule, i) => (
                        <Badge key={i} variant="secondary" className="px-3 py-1 bg-white border border-slate-200 text-slate-700">
                            {rule}
                        </Badge>
                    ))}
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-kakao-brown">+ 추가</Button>
                </div>
            </div>

            {/* 관심 주제 */}
            <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">관심 주제</Label>
                <Card className="p-4">
                    <Textarea 
                        className="min-h-[100px] border-none shadow-none p-0 focus-visible:ring-0 resize-none text-sm"
                        value={profile.favorite_topics.join("\n")}
                        onChange={e => updateProfile("favorite_topics", e.target.value.split("\n"))}
                    />
                </Card>
            </div>

            {/* 자주 쓰는 표현 */}
            <div className="space-y-3">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">자주 쓰는 표현</Label>
                <div className="space-y-2">
                    {profile.typical_patterns.map((pattern, i) => (
                        <div key={i} className="bg-kakao-yellow/10 text-kakao-brown px-4 py-2 rounded-xl text-sm border border-kakao-yellow/20">
                            "{pattern}"
                        </div>
                    ))}
                </div>
            </div>

        </div>
      </ScrollArea>
    </Layout>
  );
}
