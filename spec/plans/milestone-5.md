# תוכנית — Milestone 5: תזכורות במייל

> מבוסס על `MILESTONES.md` (Milestone 5), `PRD.md` (F1 "שכחתי סיסמה", F6, F7, F13 [הנחה], Flows 1א, 5–7, Edge Cases: "זמן התזכורת כבר עבר", "שליחת תזכורת נכשלה", "שינוי כתובת המייל", "סימון בוצע בטעות"), `ARCHITECTURE.md` (Data Model ‏`reminders`, Data Flow "תזכורות", Gmail SMTP, איפוס סיסמה, סודות, הגדרות שאינן ב-Migrations, ADR-2, ADR-6, ADR-7, ADR-18) ו-`DESIGN.md` (התחברות, איפוס סיסמה, סיסמה חדשה, מכרזים פעילים — פס "תזכורות לא נשלחו", Toast) ו-`mockups-updates.png` / `mockups-dialogs.png` (חלון "תזכורות שלא נשלחו").
> בונים על הקוד של M1–M4: ‏`proxy.ts`, ‏`app/login/*`, ‏`app/(app)/tenders/page.tsx`, ‏`lib/db/admin.ts`, ‏`lib/analysis.ts` (‏`reminderLabel`, ‏`hasFixedReminders`), ‏`components/ui/*` (Dialog, Button, Field, Toast), וה-Migrations של M3/M4 (‏`is_workday`, ‏`workdays_before`, ‏`israel_ts`, ‏`task_assignees`, Triggers הסנכרון משימה↔מועד).

## 1. מה נכנס ומה לא

**נכנס:** טבלת `reminders` ו-Triggers שיוצרים / מבטלים / מתזמנים מחדש; Endpoint ‏`POST /api/cron/reminders` ששולח ב-Gmail SMTP; מייל תזכורת בעברית RTL; מייל התראה על כשלים ל-`NOTIFY_EMAIL`; פס "תזכורות לא נשלחו" וחלון "פרטים" ב"מכרזים פעילים"; אפשרות **"בלי תזכורת"** בחלון "משימה" (החלטת המשתמשת); "שכחתי סיסמה", "איפוס סיסמה" ו"סיסמה חדשה"; הגדרת Gmail כ-Custom SMTP ב-Supabase Auth (Development); סקריפט להפעלה ידנית של ה-Endpoint.

**לא נכנס:** ה-Cron האוטומטי (`pg_cron` + `pg_net` + Vault) — M8, ב-Production בלבד. ייצוא ושליחת סיכום במייל — M6 (אבל `lib/email` נבנה כך ש-M6 ישתמש בו). "לוח בקרה" — M7: עד אז, אחרי שמירת סיסמה חדשה עוברים ל"מכרזים פעילים" (כמו אחרי התחברות היום), וב-M7 זה יוחלף ל"לוח בקרה".

## 2. צעדי הכנה של המשתמשת (בהדרכה, לפני הבדיקות)

אלה דברים שרק המשתמשת יכולה לעשות. Claude עוצר בנקודה הזו ומדריך צעד אחר צעד, בשפה פשוטה:

1. **חשבון Gmail ייעודי** לפרויקט (למשל `tenders.xxx@gmail.com`): יצירה, הפעלת **אימות דו-שלבי**, ויצירת **App Password** (סיסמת אפליקציה, 16 תווים).
2. **הוספה ל-`.env`** (השמות כבר קיימים ב-`.env.example`, אין צורך לעדכן אותו):
   - `GMAIL_USER` — כתובת ה-Gmail הייעודי.
   - `GMAIL_APP_PASSWORD` — סיסמת האפליקציה.
   - `NOTIFY_EMAIL` — הכתובת של המשתמשת (תזכורות "אליי", התראות על כשלים, Reply-To).
   - `CRON_SECRET` — מחרוזת אקראית ארוכה. Claude נותן פקודה אחת שמייצרת אותה, והמשתמשת מדביקה בעצמה.
3. **Supabase (פרויקט `tenders-dev`) → Authentication:**
   - **SMTP Settings:** הפעלת Custom SMTP — ‏Host ‏`smtp.gmail.com`, ‏Port ‏`465`, ‏Username = ‏`GMAIL_USER`, ‏Password = ה-App Password, ‏Sender email = ‏`GMAIL_USER`, ‏Sender name = "ניהול מכרזים".
   - **URL Configuration:** ‏Site URL = ‏`http://localhost:3000`; ב-Redirect URLs להוסיף `http://localhost:3000/auth/confirm` ו-`http://localhost:3000/reset-password`.
   - **Email Templates → Reset Password:** החלפת התבנית בתבנית עברית RTL ש-Claude מכין (נושא + HTML). הקישור במייל: `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password` (ראו סעיף 7 ו-ADR-21).

## 3. Database — Migration חדש

### `supabase/migrations/20261102200000_m5_reminders.sql`

1. **טבלת `reminders`:**
   - `id uuid pk`, ‏`task_id` → `tasks` (on delete cascade), ‏`team_member_id` → `team_members` (‏nullable, on delete cascade; ריק = תזכורת למשתמשת).
   - `send_at timestamptz not null`, ‏`kind text` (`scheduled` / `followup` / `self`), ‏`status text default 'pending'` (`pending` / `sent` / `cancelled` / `failed`).
   - `sent_at timestamptz`, ‏`error text` (הסיבה בעברית, להצגה בחלון).
   - **שתי עמודות נוספות לחלון "תזכורות שלא נשלחו"** (תוספת קטנה למודל הנתונים, תתועד ב-ADR-20):
     - `recipient_email text` — הכתובת שאליה ניסינו לשלוח, נשמרת **ברגע השליחה** (הכתובת עדיין נשלפת מ-`team_members` ברגע השליחה, כמו ב-ARCHITECTURE).
     - `handled_at timestamptz` — נקבע ב"סימון כטופל". תזכורת `failed` עם `handled_at` ריק = מוצגת בפס.
   - אינדקסים: ‏`(status, send_at)` ו-`task_id`.
1א. **עמודה חדשה `tasks.reminders_off boolean not null default false`** — "בלי תזכורת" (החלטת המשתמשת). כשהיא `true` לא נוצרות תזכורות למשימה, גם כשיש לה אחראים וגם במועדים הקבועים. ‏RLS "authenticated full access" (הדפדפן קורא את הכשלים ומסמן "טופל"; השליחה עצמה ב-Service Role).
2. **`reminder_slots(p_type, p_due, p_has_time, p_remind_at)`** — פונקציה שמחזירה את רשימת הזמנים `(send_at, kind)` לפי הכללים, בשעון ישראל:

   | סוג | זמנים |
   |---|---|
   | `submission` | 24 שעות לפני (בלי שעה: יום לפני ב-08:00); 3 שעות לפני — רק אם `has_time` |
   | `bidders_meeting` | 3 ימים לפני (`scheduled`); יום לפני (`followup`) |
   | `clarification_questions` | 24 שעות לפני (בלי שעה: יום לפני ב-08:00) |
   | `closing_meeting` | ‏08:00 ביום הפגישה |
   | `other` / `regular` | ‏`remind_at`, רק אם מולא |

   - **שישי, שבת וחג** (לפי `is_workday`): תזכורת שהתאריך שלה, בשעון ישראל, אינו יום עבודה מוקדמת ליום העבודה הקודם (`workdays_before(d, 1)`), **באותה שעה** שבה הייתה אמורה לצאת — לפי השעה שבמשימה, או השעה שנבחרה במועד התזכורת (החלטת המשתמשת, עודכנה ב-PRD וב-ARCHITECTURE). במועד בלי שעה זה ממילא 08:00. **"3 שעות לפני" לא מוזזת.**
   - דוגמאות: הגשה ביום ראשון 12:00 ← "יום לפני" יוצא בשבת ← חמישי 12:00. מפגש מציעים ביום שני 10:00 ← "3 ימים לפני" יוצא בשישי ← חמישי 10:00.
   - מועד בלי שעה נשמר כבר ב-08:00 (ARCHITECTURE), ולכן "יום לפני" / "3 ימים לפני" יוצאים ב-08:00 גם בלי טיפול מיוחד; הפונקציה בכל זאת מחשבת לפי תאריך + 08:00 כשאין שעה, כדי לא להיות תלויה בזה.
3. **`rebuild_task_reminders(p_task uuid)`** — הלב של הלוגיקה, נקראת מכל ה-Triggers:
   1. כל התזכורות `pending` של המשימה מסומנות `cancelled`.
   2. אם המשימה לא בוצעה, לא סומנה "בלי תזכורת" (`reminders_off`), יש לה `due_at` (או `remind_at` במשימה רגילה), והמכרז בסטטוס פעיל (`reviewing` / `preparing`) — יוצרים מחדש: לכל זמן מ-`reminder_slots` שעוד לא עבר (`send_at > now()`), שורה **לכל אחראי** ב-`task_assignees`.
   3. משימה `other` / `regular` עם `remind_at` ובלי אף אחראי ← שורה אחת `kind = 'self'`, ‏`team_member_id` ריק. בשאר הסוגים, בלי אחראי — אין תזכורות.
   - כך כל המקרים מכוסים בכלל אחד: "בוצע" ← הכול מבוטל; ביטול "בוצע" ← נוצר מחדש; שינוי מועד ← הישנות מבוטלות וחדשות נוצרות; הסרת אחראי ← שלו מבוטלות; זמן שעבר ← לא נוצר.
4. **Triggers:**
   - `tasks` — ‏`AFTER INSERT` ו-`AFTER UPDATE OF due_at, has_time, type, is_done, remind_at, reminders_off` ← `rebuild_task_reminders(new.id)`. (שינוי מועד בלוח הזמנים עובר למשימה דרך Trigger הסנכרון הקיים, ומשם לכאן.)
   - `task_assignees` — ‏`AFTER INSERT OR DELETE` ← `rebuild_task_reminders` של המשימה (אם היא עדיין קיימת). כולל מחיקת איש צוות (cascade): משימה רגילה עם מועד תזכורת שלא נשאר לה אחראי עוברת ל-`self`, לפי הכלל "אם אין אחראי, למשתמשת".
   - `tenders` — ‏`AFTER UPDATE OF status` ← לכל המשימות של המכרז. מעבר ל-`not_bidding` / `submitted` / `won` / `lost` מבטל; חזרה לסטטוס פעיל מתזמנת מחדש.
   - מחיקת משימה / מכרז ← התזכורות נמחקות ב-cascade.
5. **מילוי ראשוני:** בסוף ה-Migration, `rebuild_task_reminders` לכל המשימות הקיימות (כדי שמשימות שכבר שויכו ב-M4 יקבלו תזכורות).
6. **`claim_due_reminders()`** (Service Role בלבד) — מחזירה את התזכורות שהגיע זמנן (`pending`, ‏`send_at <= now()`), ובאותה פעולה מבטלת (`cancelled`) תזכורות שהמשימה שלהן כבר בוצעה או שהמכרז שלהן כבר לא פעיל (ליתר ביטחון). **תזכורת שהתעכבה** (למשל כי המערכת לא פעלה) נשלחת באיחור **רק אם מועד המשימה עוד לא עבר**. אם המועד כבר עבר, היא מבוטלת ולא נשלחת (החלטת המשתמשת). משימה רגילה בלי מועד (רק מועד תזכורת) נשלחת באיחור. נועלת את השורות (`for update skip locked`), כך ששתי הפעלות במקביל לא שולחות אותה תזכורת פעמיים.
7. רישום ב-`app_migrations`.

## 4. שליחת מיילים — `lib/email`

- תלות חדשה: `nodemailer` (+ `@types/nodemailer` ב-dev).
- **`lib/email/index.ts`** (`server-only`) — נקודת המגע היחידה עם Gmail:
  - Transport: ‏`smtp.gmail.com`, פורט 465, ‏`secure: true`, עם `GMAIL_USER` / `GMAIL_APP_PASSWORD`.
  - `sendEmail({ to, subject, html, text })` — ‏From: ‏`"ניהול מכרזים" <GMAIL_USER>`, ‏Reply-To: ‏`NOTIFY_EMAIL`. מחזירה הצלחה, או שגיאה מסווגת: `invalid_address` / `rejected` (השרת דחה מיד, כולל `info.rejected` לא ריק) / `other`.
  - בדיקת תבנית בסיסית של כתובת לפני שליחה (← `invalid_address`, בלי לפנות ל-Gmail).
- **`lib/email/templates.ts`** — HTML פשוט עם `dir="rtl"`, ‏`lang="he"`, גופן Arial/Heebo, ובנוסף גרסת טקסט:
  - **תזכורת:** נושא `תזכורת: <שם המשימה> · <שם המכרז>`. גוף: שלום <שם> (או בלי שם בתזכורת `self`), שם המכרז, שם המשימה, המועד (‏`DD/MM/YYYY HH:MM`, או תאריך בלבד כשאין שעה), ושורה "לשאלות אפשר להשיב למייל הזה." **רק המשימה הספציפית**, בלי קישור למערכת (הנמענים לא משתמשים בה).
  - **התראה על כשלים:** נושא `תזכורות לא נשלחו (N)`. רשימה: מכרז · משימה · נמען · סיבה. מייל אחד לכל הפעלה של ה-Endpoint שבה היו כשלים.
- עיצוב תאריכים בשעון ישראל: שימוש בפונקציה הקיימת ב-`lib/analysis.ts` (‏`formatDue`).

## 5. ה-Endpoint — `app/api/cron/reminders/route.ts`

- `POST` בלבד. אימות: ‏`Authorization: Bearer <CRON_SECRET>`. סוד חסר בשרת או כותרת שגויה ← ‏401, בלי לגעת בנתונים.
- תהליך (Service Role, ‏`createAdminClient`):
  1. `claim_due_reminders()`.
  2. לכל תזכורת: שליפת הכתובת **עכשיו** — מ-`team_members` (או `NOTIFY_EMAIL` ב-`self`), ושל שם המכרז, שם המשימה והמועד.
  3. שליחה ב-`sendEmail`. הצלחה ← `sent`, ‏`sent_at`, ‏`recipient_email`. כשל ← `failed`, ‏`recipient_email`, ‏`error` בעברית: "כתובת לא תקינה" / "השרת דחה את הכתובת" / "תקלה בשליחה" (הפרטים הטכניים נכתבים ללוג).
  4. אם היו כשלים ← מייל התראה אחד ל-`NOTIFY_EMAIL`.
  5. תשובה: ‏`{ sent, failed, cancelled }`.
- `export const maxDuration = 60` (בהיקף הצפוי זה כמה מיילים בהפעלה).
- **`proxy.ts`:** הנתיב `/api/cron/*` מוחרג מבדיקת ההתחברות (האימות שלו הוא ה-Secret).
- **הפעלה ידנית ב-Development:** סקריפט `scripts/run-reminders.mjs` + `npm run reminders:run` (‏`node --env-file=.env`), ששולח POST ל-`http://localhost:3000/api/cron/reminders` עם ה-Secret ומדפיס את התוצאה. כך אף אחד לא צריך להקליד את הסוד. יתווסף ל"פקודות הרצה" ב-CLAUDE.md.

## 6. ממשק — "תזכורות לא נשלחו" ב"מכרזים פעילים"

- `app/(app)/tenders/page.tsx`: שאילתה נוספת — תזכורות `failed` עם `handled_at` ריק, עם שם המכרז ושם המשימה.
- **`components/reminders/FailedRemindersBanner.tsx`** (Client): פס ברקע Red Tint מעל מסנני המחלקה, טקסט אדום **"● N תזכורות לא נשלחו"** (ו"תזכורת אחת לא נשלחה" כשיש אחת), וקישור **"פרטים"**. מוצג רק כש-N > 0.
- **חלון "תזכורות שלא נשלחו"** (לפי `mockups-dialogs.png`): טבלה מכרז | משימה | נמען | סיבה | כפתור Secondary קטן **"סימון כטופל"** בכל שורה. מתחת: הערה Muted "על כל תזכורת שנכשלה נשלח אלייך גם מייל.". "סימון כטופל" מעדכן `handled_at` (לקוח הדפדפן), מסיר את השורה, מציג Toast "נשמר" ומרענן את הדף (`router.refresh()`). בנייד: שורות ככרטיסים, החלון כמעט במלוא המסך.
### "בלי תזכורת" — חלון "משימה" ולשונית "משימות"
- **חלון "משימה"** (`components/tenders/TaskDialog.tsx`): במשימה מאחד ארבעת הסוגים הקבועים, מתחת לטקסט ה-Muted שמתאר את תזמון התזכורות, Checkbox **"בלי תזכורת"**. כשהוא מסומן, טקסט התזמון מוחלף ב-"לא יישלחו תזכורות על המשימה הזו." במשימה רגילה או "מועד אחר" אין צורך ב-Checkbox: משאירים את "מועד תזכורת" ריק, כמו היום.
- **עמודת "תזכורת"** בלשונית "משימות": משימה שסומנה "בלי תזכורת" מציגה **"—"** (כמו משימה בלי תזכורת). השינוי ב-`reminderLabel` שב-`lib/analysis.ts`.
- שמירה בחלון מעדכנת את `reminders_off`, וה-Trigger מבטל או יוצר את התזכורות.

## 7. איפוס סיסמה

- **מסך התחברות** (`app/login/LoginForm.tsx`): קישור Ghost קטן באפור **"שכחתי סיסמה"** מתחת ל"כניסה", ל-`/forgot-password`.
- **`app/forgot-password/`** (page + form + server action): אותה מסגרת כמו ההתחברות (רקע חצוי, כרטיס). כותרת "ניהול מכרזים", תת-כותרת "איפוס סיסמה", שדה "אימייל", כפתור אדום **"שליחת קישור לאיפוס"**. ה-Action קורא ל-`resetPasswordForEmail(email, { redirectTo: APP_URL + "/reset-password" })` ותמיד מציג את אותה הודעה: **"אם הכתובת רשומה במערכת, נשלח אליה קישור לאיפוס הסיסמה."** (בלי לגלות אם הכתובת קיימת). קישור **"חזרה לכניסה"**. אם הגיעו עם `?error=expired` מוצגת הודעה אדומה "הקישור לאיפוס פג תוקף או כבר נוצל. אפשר לבקש קישור חדש."
- **`app/auth/confirm/route.ts`** (GET): מקבל `token_hash`, ‏`type=recovery` ו-`next`; קורא ל-`verifyOtp`, ובהצלחה מעביר ל-`/reset-password` כשהמשתמשת מחוברת. בכשל ← `/forgot-password?error=expired`. ‏`next` מתקבל רק אם הוא נתיב פנימי.
- **`app/reset-password/`** (page + form + server action): כרטיס עם תת-כותרת "בחירת סיסמה חדשה", שדות "סיסמה חדשה" ו"אימות סיסמה", כפתור אדום **"שמירת הסיסמה"**. בדיקות: לפחות 8 תווים ("הסיסמה צריכה להיות באורך 8 תווים לפחות"), התאמה ("הסיסמאות לא תואמות"). ‏`updateUser({ password })` ← מעבר ל"מכרזים פעילים" (ב-M7: "לוח בקרה"). אם אין Session (נכנסו לכתובת ישירות) ← מעבר ל-`/forgot-password?error=expired`.
- **`proxy.ts`:** ‏`/forgot-password` ו-`/auth/confirm` פתוחים בלי התחברות. ‏`/reset-password` דורש Session (שנוצר ב-`/auth/confirm`), ולכן משתמשת לא מחוברת מועברת ל-`/forgot-password?error=expired` במקום ל-`/login`. משתמשת מחוברת שנכנסת ל-`/forgot-password` עדיין יכולה להשתמש בו (לא מפנים אותה).
- רכיב משותף למסגרת הכרטיס (`components/auth/AuthCard.tsx`), שמחליף את הקוד הכפול ב-`app/login/page.tsx`.

## 8. Types ו-Lib

- `lib/types.ts`: ‏`Reminder`, ‏`ReminderKind`, ‏`ReminderStatus`, ‏`FailedReminder` (עם שם המכרז והמשימה).
- `lib/types.ts`: ‏`Task.reminders_off`.
- `lib/email/*` (סעיף 4). ב-`lib/analysis.ts`: ‏`reminderLabel` מחזיר `null` כש-`reminders_off`, ושימוש חוזר ב-`formatDue`.
- `package.json`: ‏`nodemailer`, ‏`@types/nodemailer`, הסקריפט `reminders:run`.

## 9. סדר הבנייה

1. Migration ‏`m5_reminders` ← הרצה על Development (`npm run db:migrate`).
2. בדיקת הכללים ב-Database (סעיף 10, שלב א), לפני כל קוד ממשק.
3. `lib/email` + תבניות.
4. ה-Endpoint, ‏`proxy.ts`, וסקריפט ההפעלה הידנית.
5. פס "תזכורות לא נשלחו" והחלון.
6. איפוס סיסמה (`/forgot-password`, ‏`/auth/confirm`, ‏`/reset-password`, הקישור במסך ההתחברות).
7. **עצירה להדרכת המשתמשת** (סעיף 2): Gmail, ‏`.env`, הגדרות Supabase.
8. בדיקות מקצה לקצה מול ה-DoD, ‏`npm run lint`, ‏`npm run build`, בדיקה ברוחב 375px.
9. ADRs ב-ARCHITECTURE.md, עדכון "פקודות הרצה" ב-CLAUDE.md, סימון 🟡 ב-MILESTONES.md.

## 10. בדיקות מול ה-Definition of Done

**א. כללי התזמון (סקריפט בדיקה זמני מול Development, עם Service Role; מנקה את עצמו בסוף):** יוצר מכרז בדיקה ואיש צוות בדיקה עם הכתובת של המשתמשת, ובודק את `reminders` שנוצרו:

| DoD | בדיקה |
|---|---|
| 4 הסוגים יוצרים את התזכורות הנכונות לפי שעון ישראל | הגשה עם שעה (24ש׳ + 3ש׳), הגשה בלי שעה (יום לפני 08:00 בלבד), מפגש מציעים (3 ימים + followup), שאלות הבהרה (24ש׳), סגירת פינות (08:00 ביום), משימה רגילה עם `remind_at` |
| שני אחראים ← תזכורת לכל אחד | משימה עם 2 אחראים ← שורה לכל אחד בכל זמן |
| שבת / חג ← יום העבודה הקודם, באותה שעה | הגשה ביום ראשון 12:00, שה"יום לפני" שלה יוצא בשבת ← חמישי 12:00 (שישי אינו יום עבודה); מועד בלי שעה ← חמישי 08:00; מועד שה"יום לפני" יוצא בחג מטבלת `holidays`; "3 שעות לפני" בשבת לא זזה; מועד תזכורת שנבחר לשבת 14:00 ← חמישי 14:00 |
| "בלי תזכורת" | מועד הגשה משויך ← סימון "בלי תזכורת" ← כל התזכורות `cancelled`; ביטול הסימון ← נוצרות מחדש |
| תזכורת שהתעכבה | `send_at` בעבר ומועד המשימה עוד לא עבר ← נשלחת; מועד המשימה כבר עבר ← `cancelled` |
| "בוצע" מבטל, ביטול "בוצע" יוצר מחדש | סטטוסים `cancelled` ← שורות `pending` חדשות |
| משימה רגילה: בלי אחראי ← למשתמשת; עם אחראי ← לאחראי; בלי מועד תזכורת ← כלום | שלושת המקרים |
| נוסף | שינוי מועד במשימה מקושרת / בלוח הזמנים מתזמן מחדש; הסרת אחראי מבטלת רק את שלו; מעבר ל"לא ניגשים" / "הוגש" מבטל, וחזרה ל"ניגשים" מתזמנת; זמן שעבר לא נוצר |

**ב. שליחה (אחרי הכנת המשתמשת):**
- תזכורת בדיקה עם `send_at` בעבר הקרוב לכתובת של המשתמשת ← `npm run reminders:run` ← המייל מגיע, בעברית RTL, עם המשימה הספציפית בלבד, וה-Reply-To הוא `NOTIFY_EMAIL`. השורה ב-`sent`.
- **ספאם:** המשתמשת מוסיפה כתובת ארגונית אמיתית (שלה או של עובד שהסכים) ובודקת שהמייל הגיע לתיבה הראשית ולא לספאם. אם הוא בספאם — עוצרים ומחליטים יחד (למשל סימון "לא ספאם" / כלל ב-Outlook).
- קריאה בלי Secret / עם Secret שגוי ← 401.
- איש צוות עם כתובת שגויה (למשל `bad@` / דומיין לא קיים) ← `failed`, מייל התראה ל-`NOTIFY_EMAIL`, ופס "● 1 תזכורת לא נשלחה" ב"מכרזים פעילים"; "פרטים" ← "סימון כטופל" מעלים את הפס.

**ג. איפוס סיסמה:**
- Claude בודק את הזרימה בדפדפן עם משתמש הבדיקה (קישור שמופק ב-Admin API, בלי מייל): ‏`/auth/confirm` ← `/reset-password` ← שמירה ← כניסה עם הסיסמה החדשה; קישור פג / שגוי ← הודעה ב-`/forgot-password`; סיסמאות לא תואמות ← הודעה.
- המשתמשת בודקת את הזרימה האמיתית: "שכחתי סיסמה" ← מייל בעברית מחשבון ה-Gmail ← קישור ← סיסמה חדשה ← כניסה עם הסיסמה החדשה.

**ד. ממשק:** כל המסכים החדשים תואמים ל-`mockups-updates.png` / `mockups-dialogs.png`, ותקינים ברוחב 375px בלי גלילה לרוחב.

## 11. ADRs שיתועדו ב-ARCHITECTURE.md

- **ADR-20: תזכורות נבנות מחדש בכל שינוי (`rebuild_task_reminders`)** — במקום Trigger נפרד לכל מקרה, כל שינוי מבטל את התזכורות הממתינות של המשימה ויוצר אותן מחדש לפי המצב הנוכחי. כולל את העמודות `recipient_email` ו-`handled_at` ואת `claim_due_reminders`.
- **ADR-21: קישור איפוס סיסמה עם `token_hash`** — הקישור במייל עובר דרך `/auth/confirm` ו-`verifyOtp`, ולא דרך קוד PKCE. כך הוא עובד גם כשמבקשים את האיפוס במחשב ופותחים את המייל בטלפון. דורש עריכה חד-פעמית של תבנית המייל ב-Supabase (גם ב-Production, ב-M8).

## 12. נקודות שבהן עוצרים ושואלים את המשתמשת

**הוחלט (2.11.2026):**
- כל תזכורת שנופלת בשישי, בשבת או בחג מוקדמת ליום העבודה הקודם **באותה שעה** (לפי השעה שבמשימה או במועד התזכורת), ולא ב-08:00. במועד בלי שעה — 08:00.
- תזכורת שהתעכבה נשלחת באיחור רק אם מועד המשימה עוד לא עבר. אחרת היא מבוטלת.
- מועד בלי שעה: התזכורות ב-08:00, כמו ב-PRD.
- אפשרות "בלי תזכורת" לכל משימה מהסוגים הקבועים (`tasks.reminders_off`).
- ההחלטות יתועדו ב-ADR-20.

**עצירות במהלך הבנייה:**
1. צעדי ההכנה בסעיף 2 (Gmail, ‏`.env`, Supabase) — עצירה והדרכה.
2. אם המייל מגיע לספאם בכתובת הארגונית — עצירה והחלטה משותפת.
