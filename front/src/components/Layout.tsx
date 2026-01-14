import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  className?: string;
  showHeader?: boolean;
  title?: string;
  action?: ReactNode;
}

export function Layout({ 
  children, 
  className, 
  showHeader = true, 
  title = "카카오챗",
  action 
}: LayoutProps) {
  return (
    <div className="min-h-screen w-full bg-slate-100 flex items-center justify-center p-0 sm:p-4">
      <div className={cn(
        "w-full h-[100dvh] sm:h-[850px] sm:max-w-[400px]",
        "bg-background sm:rounded-[2rem] sm:shadow-2xl overflow-hidden flex flex-col relative",
        "border border-slate-200/50",
        className
      )}>
        {/* 상태바 모형(장식용) */}
        <div className="h-8 bg-transparent w-full flex justify-between items-center px-6 text-xs font-medium text-muted-foreground select-none z-50">
          <span>9:41</span>
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-foreground/20" />
            <div className="w-3 h-3 rounded-full bg-foreground/20" />
            <div className="w-4 h-3 rounded-[3px] border border-foreground/20" />
          </div>
        </div>

        {/* 헤더 */}
        {showHeader && (
          <header className="px-5 py-3 flex items-center justify-between bg-background/80 backdrop-blur-md z-40 sticky top-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
            {action}
          </header>
        )}

        {/* 본문 */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col">
          {children}
        </main>
      </div>
    </div>
  );
}
