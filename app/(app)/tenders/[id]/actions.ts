"use server";

import { createClient } from "@/lib/db/server";
import { loadTenderSummary, summaryPartsText } from "@/lib/summary";
import type { SummaryPart } from "@/lib/types";

export type EmailDraft = {
  parts: Record<SummaryPart, string>;
  members: { id: string; name: string; email: string }[];
};

// Text of the four parts and the team list, for the "שליחה במייל" dialog; null on failure
export async function getEmailDraft(tenderId: string): Promise<EmailDraft | null> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return null;

  try {
    const [summary, members] = await Promise.all([
      loadTenderSummary(supabase, tenderId),
      supabase.from("team_members").select("id, name, email").order("name"),
    ]);
    if (!summary || members.error) return null;
    return { parts: summaryPartsText(summary), members: members.data };
  } catch {
    return null;
  }
}
