import { Archive, Check, LayoutDashboard, List, Users, type LucideIcon } from "lucide-react";

// The main areas of the app; shared by the side menu and the dashboard's buttons
export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "לוח בקרה", icon: LayoutDashboard },
  { href: "/tenders", label: "מכרזים פעילים", icon: List },
  { href: "/archive", label: "ארכיון", icon: Archive },
  { href: "/submitted", label: "הוגשו", icon: Check },
  { href: "/team", label: "אנשי צוות", icon: Users },
];
