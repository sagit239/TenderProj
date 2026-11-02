import type { Metadata } from "next";
import { NewTenderForm } from "@/components/tenders/NewTenderForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "מכרז חדש · ניהול מכרזים" };

export default function NewTenderPage() {
  return (
    <>
      <Breadcrumb href="/tenders" label="מכרזים פעילים" />
      <PageHeader title="מכרז חדש" />
      <NewTenderForm />
    </>
  );
}
