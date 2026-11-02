import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

export default function TenderNotFound() {
  return (
    <div className="rounded-card border border-line bg-white px-6 py-12 text-center shadow-card">
      <h1 className="mb-2 text-h2">המכרז לא נמצא</h1>
      <p className="mb-4 text-body text-muted">ייתכן שהוא נמחק.</p>
      <Link href="/tenders" className={buttonClasses("primary")}>
        מעבר למכרזים פעילים
      </Link>
    </div>
  );
}
