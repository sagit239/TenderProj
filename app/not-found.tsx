import Link from "next/link";
import { buttonClasses } from "@/components/ui/Button";

// 404: an address that does not exist in the app
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-white px-6 py-12 text-center shadow-card">
        <p className="mb-1 text-small text-muted" dir="ltr">404</p>
        <h1 className="mb-2 text-h2">הדף לא נמצא</h1>
        <p className="mb-4 text-body text-muted">ייתכן שהכתובת שגויה, או שהדף נמחק.</p>
        <Link href="/dashboard" className={buttonClasses("primary")}>
          מעבר ללוח הבקרה
        </Link>
      </div>
    </main>
  );
}
