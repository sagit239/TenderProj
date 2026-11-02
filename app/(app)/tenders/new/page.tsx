import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "מכרז חדש · ניהול מכרזים" };

// Built in Milestone 2
export default function Page() {
  return <PageHeader title="מכרז חדש" />;
}
