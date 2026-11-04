import { NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { buildSummaryDocx } from "@/lib/export/docx";
import { loadTenderSummary } from "@/lib/summary";

// Downloads the tender summary as a Word file (PRD F11)
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const summary = await loadTenderSummary(supabase, id).catch(() => null);
  if (!summary) return NextResponse.json({ error: "not found" }, { status: 404 });

  const buffer = await buildSummaryDocx(summary);
  // Hebrew file name via filename*; characters Windows forbids in file names are replaced
  const fileName = `${summary.name.replace(/[\\/:*?"<>|]+/g, "-").trim() || "מכרז"}.docx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="tender.docx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
