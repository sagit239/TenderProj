"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/db/client";
import { isAnalysisFailed, isAnalysisRunning, startAnalysis } from "@/lib/analysis";
import type { TenderAnalysis } from "@/lib/types";

const POLL_MS = 5000;

type Props = {
  tenderId: string;
  analysis: TenderAnalysis;
  hasReadWarnings: boolean;
  documentsHref: string;
};

// Analysis state under the tabs: running, failed (with retry), or done with partly read files
export function AnalysisBanner({ tenderId, analysis, hasReadWarnings, documentsHref }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [retrying, setRetrying] = useState(false);
  const running = isAnalysisRunning(analysis);

  // While running, check the status every few seconds and refresh the page when it changes
  useEffect(() => {
    if (!running) return;
    const supabase = createClient();
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("tenders")
        .select("analysis_status, analysis_started_at")
        .eq("id", tenderId)
        .single();
      if (!data) return;
      const now = data as TenderAnalysis;
      if (now.analysis_status === "done") toast("הניתוח הסתיים");
      if (!isAnalysisRunning(now)) router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [running, tenderId, router, toast]);

  async function retry() {
    setRetrying(true);
    const ok = await startAnalysis(tenderId);
    setRetrying(false);
    if (!ok) toast("לא הצלחנו להפעיל את הניתוח. אפשר לנסות שוב.", "error");
    router.refresh();
  }

  if (running) {
    return (
      <div role="status" className="mb-4 flex items-center gap-2 rounded-control border border-line bg-surface px-4 py-3">
        <Loader2 size={16} strokeWidth={1.75} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
        <span>בניתוח… זה יכול לקחת כמה דקות. אפשר לעבור למסכים אחרים בינתיים.</span>
      </div>
    );
  }

  if (isAnalysisFailed(analysis)) {
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-control bg-accent-tint px-4 py-2.5 text-accent">
        <span>הניתוח לא הצליח. הקבצים נשמרו.</span>
        <button type="button" onClick={retry} disabled={retrying} className={buttonClasses("accent", "sm")}>
          ניסיון חוזר
        </button>
      </div>
    );
  }

  if (analysis.analysis_status === "done" && hasReadWarnings) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-warning/10 px-4 py-2.5 text-warning">
        <AlertTriangle size={16} strokeWidth={1.75} className="shrink-0" aria-hidden />
        <span>חלק מהמסמכים נקראו חלקית, ולכן הניתוח עלול להיות חלקי.</span>
        <Link href={documentsHref} className="font-semibold underline">
          פרטים
        </Link>
      </div>
    );
  }

  return null;
}
