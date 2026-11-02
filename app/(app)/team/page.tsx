import type { Metadata } from "next";
import { TeamList } from "@/components/team/TeamList";
import { createClient } from "@/lib/db/server";
import type { Role, TeamMember } from "@/lib/types";

export const metadata: Metadata = { title: "אנשי צוות · ניהול מכרזים" };

export default async function TeamPage() {
  const supabase = await createClient();
  const [members, roles] = await Promise.all([
    supabase.from("team_members").select("id, name, role, email, created_at").order("created_at"),
    supabase.from("roles").select("key, label").order("sort_order"),
  ]);

  return (
    <TeamList
      initialMembers={(members.data ?? []) as TeamMember[]}
      initialRoles={(roles.data ?? []) as Role[]}
      loadFailed={Boolean(members.error || roles.error)}
    />
  );
}
