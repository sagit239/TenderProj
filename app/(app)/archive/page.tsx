import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "ארכיון · ניהול מכרזים" };

// Built in Milestone 2
export default function Page() {
  return <PageHeader title="ארכיון" subtitle="מכרזים שהוחלט לא לגשת אליהם" />;
}
