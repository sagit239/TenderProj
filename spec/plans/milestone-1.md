# תוכנית — Milestone 1: הקמה, התחברות ואנשי צוות

> מבוסס על `MILESTONES.md` (Milestone 1), `PRD.md` (F1, F2, Flow 1, Flow 11), `ARCHITECTURE.md` ו-`DESIGN.md` (App Shell, התחברות, אנשי צוות, Style Guide, התאמה לנייד) ותמונות ה-Wireframes, ה-Mockups וה-Style Guide.

## 1. מטרה
בסיום: האפליקציה רצה מקומית (`npm run dev`) ומחוברת לפרויקט Supabase ‏`tenders-dev`. אפשר להתחבר עם סיסמה, להתנתק, לנווט בתפריט (גם בנייד) ולנהל את רשימת אנשי הצוות.

**מחוץ לטווח של M1:** טבלאות מכרזים, העלאת קבצים, ניתוח AI, מיילים, "שכחתי סיסמה" (ב-M5, כשיש חשבון מייל), פריסה ל-Vercel, ופרויקט ה-Production (נוצר רק ב-M7, ‏ADR-8).

---

## 2. סדר העבודה

### שלב א' — הקמת Supabase (המשתמשת, בהדרכה צעד אחר צעד)
Claude עוצר בתחילת הבנייה ומדריך בשפה פשוטה. המשתמשת מבצעת:
1. יצירת חשבון ב-supabase.com (אם אין).
2. יצירת פרויקט **`tenders-dev`** (אזור קרוב לישראל, למשל Frankfurt; שמירת סיסמת ה-Database בצד).
3. ב-`tenders-dev`:
   - **Authentication → Users → Add user:** יצירת המשתמשת (אימייל + סיסמה, "Auto Confirm User" מסומן).
   - **Authentication → Sign In / Providers:** כיבוי "Allow new users to sign up".
   - **Authentication → URL Configuration:** ‏Site URL = `http://localhost:3000`.
4. מילוי `.env` (אחרי ש-Claude יוצר אותו) בפרטי ה-Development בלבד:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (מ-Project Settings → API Keys; אפשר גם את ה-Publishable key), `SUPABASE_SERVICE_ROLE_KEY`.
   - `SUPABASE_DB_URL` — מחרוזת החיבור מסוג **Session pooler** (תומכת ב-IPv4), עם סיסמת ה-Database.
   - `APP_URL=http://localhost:3000` ו-`NOTIFY_EMAIL` (כתובת המייל של המשתמשת) אפשר כבר למלא.
   - שאר המשתנים (`ANTHROPIC_*`, `GMAIL_*`, `CRON_SECRET`) נשארים ריקים בשלב זה.

**לבדיקה העצמית של Claude:** הסקריפט `scripts/create-test-user.mjs` (מורץ עם `node --env-file=.env`, כך ש-Claude לא קורא את `.env`) יוצר ב-`tenders-dev` משתמש בדיקה נפרד עם סיסמה אקראית, דרך ה-Service Role. הפרטים נשמרים בקובץ מקומי `.env.test.local`, שמוחרג מ-Git (`.env.*` ב-`.gitignore`). כך אין צורך למסור סיסמאות בצ'אט. משתמש הבדיקה נמחק בסוף ה-Milestone, אחרי אישור המשתמשת.

### שלב ב' — שלד הפרויקט
- יצירת פרויקט Next.js 16 (App Router) + TypeScript + Tailwind CSS + ESLint, בשורש התיקייה (`create-next-app` עם `--src-dir=false`, `--app`, `--tailwind`, `--ts`, ‏npm).
- **לא** מחליפים את `.gitignore` הקיים (הוא כבר מכסה `node_modules/`, `.next/`, `.env`, `supabase/.temp/`). אם `create-next-app` מתנגש עם קבצים קיימים — יוצרים בתיקייה זמנית ומעבירים, בלי לדרוס את `.gitignore`, `CLAUDE.md` ו-`spec/`.
- תלויות: `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react` (אייקונים קוויים). תלות פיתוח: `supabase` (CLI, להרצת Migrations).
- `.env.example` עם כל 11 שמות המשתנים מ-ARCHITECTURE.md (כולל `NOTIFY_EMAIL`), בלי ערכים, והעתקה חד-פעמית ל-`.env`. Claude לא קורא את `.env`.

### שלב ג' — Database
### שלב ד' — קוד האפליקציה
### שלב ה' — בדיקה מול ה-Definition of Done, סימון 🟡, עדכון "פקודות הרצה" ב-CLAUDE.md

(פירוט שלבים ג'–ה' בסעיפים הבאים.)

---

## 3. מבנה קבצים

```
app/
  layout.tsx                 # <html lang="he" dir="rtl">, Heebo via next/font/google, metadata
  globals.css                # Tailwind + design tokens (@theme)
  page.tsx                   # redirect → /tenders
  login/
    page.tsx                 # login screen (no App Shell)
    actions.ts               # server actions: signIn, signOut
  (app)/                     # route group with the App Shell
    layout.tsx               # TopBar + Sidebar + mobile Drawer
    tenders/page.tsx         # "מכרזים פעילים" — empty page with title
    tenders/new/page.tsx     # "מכרז חדש" — empty page with title (built in M2)
    archive/page.tsx         # "ארכיון" — empty page with title
    submitted/page.tsx       # "מכרזים שהוגשו" — empty page with title
    team/page.tsx            # "אנשי צוות" — list + add/edit/delete
components/
  shell/TopBar.tsx           # black bar, red mark + "ניהול מכרזים", ☰ (mobile), "התנתקות"
  shell/Sidebar.tsx          # "+ מכרז חדש" + 4 nav items, active state
  shell/MobileDrawer.tsx     # drawer from the right, closes on navigation / backdrop / Esc
  ui/Button.tsx              # variants: accent, primary, secondary, ghost; size sm/md
  ui/Input.tsx, ui/Select.tsx, ui/Field.tsx   # label above, error below
  ui/Dialog.tsx              # modal (near full-screen on mobile), focus trap, Esc
  ui/PageHeader.tsx          # title on the right, action on the left, wraps on mobile
  team/TeamList.tsx          # client component: table (desktop) / cards (mobile)
  team/TeamMemberDialog.tsx  # add/edit form
  team/DeleteMemberDialog.tsx
lib/
  db/client.ts               # createBrowserClient (@supabase/ssr)
  db/server.ts               # createServerClient with cookies
  roles.ts                   # 6 role keys → Hebrew labels
  types.ts                   # TeamMember type
proxy.ts                     # Next 16 (formerly middleware.ts): session refresh + auth redirects
supabase/
  config.toml                # minimal, created by `supabase init`
  migrations/
    20261101120000_m1_init.sql
scripts/
  db-migrate.mjs             # runs `supabase db push --db-url $SUPABASE_DB_URL`
  create-test-user.mjs       # creates a dev-only test user, writes credentials to .env.test.local
.env.example
```

---

## 4. Database (Migration של M1)

קובץ: `supabase/migrations/20261101120000_m1_init.sql`

```sql
-- Migration log, one row per applied migration (per environment)
create table if not exists public.app_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);
alter table public.app_migrations enable row level security;
-- no policies: only service role / SQL editor can read or write

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  role text not null check (role in ('legal','accounting','team_manager','agent','division_manager','service_manager')),
  email text not null check (position('@' in email) > 1),
  created_at timestamptz not null default now()
);
alter table public.team_members enable row level security;
create policy "authenticated full access" on public.team_members
  for all to authenticated using (true) with check (true);

insert into public.app_migrations (name) values ('20261101120000_m1_init');
```

- **הרצה על Development:** ‏`npm run db:migrate` → `node --env-file=.env scripts/db-migrate.mjs`, שמריץ את Supabase CLI עם `SUPABASE_DB_URL` מתוך הסביבה (כך Claude לא צריך לקרוא את `.env`).
- **אימות:** שאילתת `select * from app_migrations` (דרך אותו CLI / סקריפט קטן) מראה את השורה.
- **Production:** לא נוגעים. הקובץ יורץ שם ב-M7 דרך SQL Editor (ADR-3).

---

## 5. אימות והגנה על דפים

- **`proxy.ts`** (ב-Next.js 16 `middleware.ts` נקרא `proxy.ts`): מרענן את ה-Session לפי התבנית הרשמית של `@supabase/ssr`, ו:
  - משתמשת לא מחוברת שפונה לכל נתיב חוץ מ-`/login` → הפניה ל-`/login`.
  - משתמשת מחוברת שפונה ל-`/login` → הפניה ל-`/tenders`.
  - `matcher` מחריג קבצים סטטיים (`_next/static`, `_next/image`, `favicon.ico`, תמונות).
- **הגנה כפולה:** ב-`app/(app)/layout.tsx` גם בודקים `supabase.auth.getUser()` ומפנים ל-`/login` אם אין משתמשת.
- **התחברות:** Server Action ‏`signIn` עם `signInWithPassword`. בהצלחה → `redirect('/tenders')`. בכישלון → חזרה לטופס עם ההודעה **"האימייל או הסיסמה שגויים, אפשר לנסות שוב"** (לפי ה-Style Guide), מוצגת באדום מתחת לשדה הסיסמה, והשדה במסגרת אדומה. שגיאת רשת → **"לא הצלחנו להתחבר כרגע. אפשר לנסות שוב בעוד רגע."**
- **התנתקות:** Server Action ‏`signOut` → `redirect('/login')`. מופעל מהקישור "התנתקות" בפס העליון (טופס עם כפתור בעיצוב קישור).
- כפתור "כניסה" מציג מצב טעינה ("מתחברת…") ומושבת בזמן השליחה.

---

## 6. עיצוב — Design Tokens

ב-`app/globals.css` (Tailwind v4, ‏`@theme`):

| Token | ערך |
|---|---|
| `--color-accent` | `#A3140F` |
| `--color-accent-dark` | `#7A0E0B` |
| `--color-accent-tint` | `#FBEAE9` |
| `--color-charcoal` | `#3A3A3D` (תגית "רפואי") |
| `--color-slate` | `#6E6E73` (תגית "בטיחות", מוכן לשימוש ב-M2) |
| `--color-ink` | `#0E0E10` |
| `--color-ink-active` | `#26262A` |
| `--color-text` | `#1E1E21` |
| `--color-muted` | `#6E6E73` |
| `--color-line` | `#E2E2E5` |
| `--color-input-border` | `#C9C9CD` |
| `--color-surface` | `#F5F5F6` |
| `--color-done` | `#2F6B4F` |
| `--color-warning` | `#A86A12` |
| `--radius-tag/control/card` | 4px / 6px / 12px |
| `--shadow-card`, `--shadow-dialog` | צל עדין / צל עמוק |
| גופן | Heebo (`next/font/google`, subsets `hebrew` + `latin`, משקלים 400/500/600/700/800), גיבוי Arial |

טיפוגרפיה (Display 32/40·800, H1 24/32·700, H2 20/28·600, H3 16/24·600, Body 14/22·400, Small 12/18·500) כמחלקות utility. מספרים ותאריכים ב-`tabular-nums`.

**כלל האדום:** אדום רק ל"+ מכרז חדש" בתפריט, לכפתור "כניסה", לסימון פריט פעיל ולשגיאות. בדף "אנשי צוות" הכפתור "+ הוספת איש צוות" הוא **Primary שחור** (לפי Mockups).

---

## 7. מסכים

### 7.1 התחברות (`/login`)
- בלי App Shell. רקע חצוי: Ink Black בחלק העליון (~35% מהגובה), Surface בתחתון.
- כרטיס לבן במרכז (רוחב ~360px, צל Dialog, פינות 12px): "ניהול מכרזים" (Display), קו אדום קצר מתחת, "כניסה למערכת" (Muted).
- שדות "אימייל" (`type=email`, `dir=ltr`, placeholder `name@example.com`) ו"סיסמה" — תוויות מעל השדות.
- כפתור Accent "כניסה" ברוחב מלא.
- בנייד: הכרטיס ברוחב מלא עם ריווח צד 16px.

### 7.2 App Shell (`app/(app)/layout.tsx`)
- **פס עליון** (Ink Black, גובה ~48px): מימין סימן אדום קצר (פס אנכי 3px) + "ניהול מכרזים" בלבן מודגש. משמאל "התנתקות" באפור.
- **תפריט צד מימין** (Ink Black, רוחב ~200px, קבוע מ-768px ומעלה):
  - כפתור Accent "+ מכרז חדש" ← `/tenders/new`.
  - פריטים עם אייקוני `lucide-react` (stroke 1.75): "מכרזים פעילים" (`List`) ← `/tenders`, "ארכיון" (`Archive`) ← `/archive`, "הוגשו" (`Check`) ← `/submitted`, "אנשי צוות" (`Users`) ← `/team`.
  - פריט פעיל (לפי `usePathname`): רקע `#26262A`, טקסט לבן SemiBold, פס אדום 3px בצד ימין. `aria-current="page"`.
- **אזור תוכן:** רקע Surface, ריווח 24px (16px בנייד).
- **נייד (< 768px):** התפריט מוסתר. כפתור ☰ (`Menu`, 44×44) בצד ימין של הפס העליון פותח Drawer מימין עם אותו תוכן. נסגר בבחירת פריט, בלחיצה על הרקע, ב-Esc ובכפתור ✕. נעילת גלילה של הדף כשהוא פתוח.

### 7.3 דפים ריקים
"מכרזים פעילים", "ארכיון", "מכרזים שהוגשו", "מכרז חדש": `PageHeader` עם הכותרת בלבד (ב"ארכיון" גם תת-הכותרת "מכרזים שהוחלט לא לגשת אליהם"), בלי תוכן נוסף. ייבנו ב-M2.

### 7.4 אנשי צוות (`/team`)
- `PageHeader`: "אנשי צוות" מימין, "+ הוספת איש צוות" (Primary) משמאל. בנייד הכפתור יורד מתחת לכותרת אם אין מקום.
- **מחשב:** טבלה לבנה (מסגרת Line, פינות 10px), עמודות: שם | תפקיד | אימייל | פעולות ("✎ עריכה · 🗑 מחיקה" — ‏Ghost באפור, עם אייקונים `Pencil`/`Trash2`). אימייל ב-`dir="ltr"`. כותרות עמודות Muted על רקע אפור בהיר.
- **נייד:** כל איש צוות ככרטיס לבן: השם בראש, ומתחתיו "תפקיד: …" ו"אימייל: …", וכפתורי עריכה/מחיקה (44px מגע).
- **מצב ריק:** "עדיין אין אנשי צוות. אפשר להוסיף את הראשון." + כפתור "+ הוספת איש צוות".
- **חלון הוספה/עריכה (Dialog):** כותרת "הוספת איש צוות" / "עריכת איש צוות". שדות: "שם" (חובה), "תפקיד" (Select עם 6 התוויות, חובה, ברירת מחדל ריקה "בחירת תפקיד"), "אימייל" (חובה, בדיקת פורמט, `dir=ltr`). ולידציה ב-blur ובשליחה, השגיאה נעלמת כשמתקנים. כפתורים: "שמירה" (Primary) ו"ביטול" (Secondary). בנייד — כמעט מסך מלא.
- **מחיקה:** חלון אישור "למחוק את <שם> מרשימת אנשי הצוות?" עם "מחיקה" (Accent) ו"ביטול". (האזהרה על משימות פתוחות תתווסף ב-M4, כשיהיו משימות.)
- **נתונים:** קריאה וכתיבה ישירות מהדפדפן ל-`team_members` דרך `lib/db/client.ts` (מוגן ב-RLS). רשימה ממוינת לפי `created_at`. אחרי כל פעולה — רענון הרשימה. שגיאת שמירה → הודעה "השמירה לא הצליחה. אפשר לנסות שוב." בתוך החלון.
- **תוויות התפקידים** (`lib/roles.ts`):

| key | תווית |
|---|---|
| `legal` | ייעוץ משפטי |
| `accounting` | הנהלת חשבונות |
| `team_manager` | מנהל צוות/תחום |
| `agent` | סוכן |
| `division_manager` | מנהל חטיבה |
| `service_manager` | מנהל שירות |

---

## 8. נגישות ו-Responsive
- כל השדות עם `<label>` גלוי, focus ring נראה (מסגרת `#1E1E21` + הילה), Dialog עם focus trap והחזרת הפוקוס, Esc לסגירה.
- יעדי מגע 44px לפחות בנייד (כפתורים, Select, פריטי תפריט, ☰).
- אין גלילה לרוחב ב-375px.

---

## 9. CLAUDE.md — "פקודות הרצה"
בסיום הבנייה:
- **הרצה (dev):** `npm run dev` (ואז http://localhost:3000)
- **בדיקות (test):** אין (בדיקת תקינות: `npm run lint` ו-`npm run build`)

## 10. ADRs שיתווספו ל-ARCHITECTURE.md (אם יתקבלו במהלך הבנייה)
- **ADR-5: הרצת Migrations על Development דרך `supabase db push --db-url`** — הקבצים בשם `<timestamp>_<name>.sql`; ה-CLI מנהל גם רישום משלו בנוסף ל-`app_migrations`.
- **ADR-6: אייקונים מ-`lucide-react`** — קוויים, עובי 1.75, תואמים ל-Style Guide.

---

## 11. בדיקה עצמית לפני סימון 🟡 (מול ה-Definition of Done)
| תנאי | איך בודקים |
|---|---|
| פרויקט `tenders-dev` קיים, `.env` מחובר אליו | אישור מהמשתמשת; האפליקציה מתחברת ל-URL של `tenders-dev` |
| Migrations של M1 הורצו ונרשמו ב-`app_migrations` | שאילתה על Development |
| סיסמה שגויה → הודעת שגיאה; נכונה → "מכרזים פעילים" | דפדפן מובנה, עם משתמש הבדיקה |
| גישה לדף בלי התחברות → `/login`; "התנתקות" → `/login` | פנייה ישירה ל-`/team`, `/archive` וכו' בלי Session |
| הוספה, עריכה ומחיקה של איש צוות נשמרות אחרי רענון | דפדפן מובנה |
| התפריט והמסכים תואמים ל-Mockups; ב-375px ☰ פותח Drawer ואין גלילה לרוחב | צילומי מסך במחשב וב-375px; בדיקת `scrollWidth <= innerWidth` |
| `npm run build` ו-`npm run lint` עוברים | הרצה |

בסיום הבדיקה — סגירת שרת הפיתוח, מחיקת אנשי הצוות שנוצרו לבדיקה (אם נוצרו), שאלה למשתמשת אם למחוק את משתמש הבדיקה, סימון 🟡 ב-MILESTONES.md. בלי commit.
