import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { createClient } from "@/lib/db/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Second line of defense after the proxy
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
