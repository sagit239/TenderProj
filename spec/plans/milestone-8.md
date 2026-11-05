# תוכנית — Milestone 8: פריסה ל-Production

> מקורות: MILESTONES.md (M8), ARCHITECTURE.md ("תשתיות, Hosting, Deployment ו-Configuration", "נוהל Database Migrations", "הגדרות שאינן עוברות ב-Migrations", ADR-2, ADR-3, ADR-4, ADR-8, ADR-21), CLAUDE.md (פריסה, Production, סודות).
> בדיקות שנעשו בזמן התכנון (4.11.2026): תיעוד עדכני של Supabase, ובדיקת קריאה בלבד של ההרשאות במסד ה-Development.

## 1. מה נכנס ומה לא
- **נכנס:** יצירת `tenders-prod`, הרצת כל ה-Migrations, הגדרות Auth, הפעלת Cron, חיבור Vercel, משתני סביבה, בדיקת קצה בסביבה האמיתית, ובדיקה שאין סודות ב-GitHub.
- **נכנס גם (תוספת שנדרשת, סעיף 2):** Migration אחד חדש של הרשאות. בלעדיו האפליקציה לא תעבוד על פרויקט Supabase חדש.
- **לא נכנס:**
  - העברת נתונים מ-Development. ה-spec לא דורש זאת, ולכן Production מתחיל ריק (חוץ מ-6 התפקידים והחגים, שמגיעים מה-Migrations). את אנשי הצוות מזינים מחדש.
  - דומיין פרטי: הכתובת תהיה `<שם-הפרויקט>.vercel.app`.
  - גיבויים, ניטור, ומעבר ל-Vercel Pro (ADR-4).
  - פריסת תצוגה מקדימה לענפים: עובדים רק על `main`.
- **אין פיצ'רים חדשים ואין ספריות חדשות.**

## 2. ממצא חשוב: הרשאות בפרויקט Supabase חדש
**הבעיה.** מאז 30.5.2026 פרויקט Supabase חדש לא נותן אוטומטית לאפליקציה גישה לטבלאות חדשות. צריך לתת הרשאה מפורשת, אחרת הקריאות מהאפליקציה נכשלות.
- ה-Migrations שלנו לא כוללים הרשאות לטבלאות. הן מגיעות היום מברירת המחדל.
- נבדק מול `tenders-dev`: ברירת המחדל הישנה עדיין פעילה בו (14 טבלאות עם הרשאות). לכן **העובדה שהכול עובד ב-Development לא מוכיחה שזה יעבוד ב-Production.**

**הפתרון.** Migration חדש, אחרון בסדר: `supabase/migrations/20261104160000_m8_explicit_grants.sql`:

```sql
-- Milestone 8: explicit access rights. New Supabase projects no longer grant them by default.
grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

-- Server-only functions stay closed to the signed-in browser user (ADR-17, ADR-19, ADR-20)
revoke execute on function public.save_analysis(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.fail_analysis(uuid, text) from public, anon, authenticated;
revoke execute on function public.save_reanalysis(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.claim_due_reminders() from public, anon, authenticated;

-- Nothing in the app reads data without signing in, so the anonymous role gets no table access
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

insert into public.app_migrations (name) values ('20261104160000_m8_explicit_grants')
  on conflict (name) do nothing;
```

- ההרשאות ניתנות רק ל-`authenticated` ול-`service_role`. כל מדיניות ה-RLS שלנו מיועדת ל-`authenticated`, ולכן `anon` לא צריך גישה.
- ה-`revoke` מ-`anon` מיישר את Development עם Production. כך בדיקה ב-Development אחרי ה-Migration כן מראה שהאפליקציה עובדת בלי גישה אנונימית.
- ה-Bucket וה-Storage לא מושפעים: השינוי של Supabase חל רק על `public`.
- בעתיד: כל טבלה חדשה ב-Migration צריכה שורת `grant` משלה. זה נרשם ב-ADR-26.

## 3. מפתחות Supabase בפרויקט החדש
Supabase מחליפה את המפתחות הישנים (`anon`, ‏`service_role`) במפתחות חדשים (`sb_publishable_...`, ‏`sb_secret_...`), והישנים יוצאים משימוש עד סוף 2026.
- ב-Production משתמשים ב**מפתחות החדשים**. אם הפרויקט מציג רק אותם, אין בחירה בכלל.
- שמות המשתנים לא משתנים ואין שינוי קוד:
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` ← המפתח שמתחיל ב-`sb_publishable_`.
  - `SUPABASE_SERVICE_ROLE_KEY` ← המפתח שמתחיל ב-`sb_secret_`.
- השם `ANON_KEY` נשאר, אף שהוא כבר לא מדויק. שינוי שם יחייב עדכון ב-5 קבצים בלי תועלת. נרשם ב-ADR-27.

## 4. קבצים ליצור ולשנות (עבודה של Claude)
| קובץ | שינוי |
|---|---|
| `supabase/migrations/20261104160000_m8_explicit_grants.sql` | **חדש.** סעיף 2 |
| `supabase/production/cron-reminders.sql` | **חדש.** הפעלת ההרחבות ויצירת ה-Job (סעיף 5, שלב 6). לא נמצא ב-`migrations/`, כדי שלא ירוץ על Development |
| `supabase/production/verify.sql` | **חדש.** שאילתת בדיקה לקריאה בלבד, שמודבקת ב-SQL Editor אחרי ה-Migrations (רשימת ה-Migrations, מספר הטבלאות עם הרשאות, RLS פעיל בכולן, ומצב ה-Cron) |
| `spec/ARCHITECTURE.md` | הוספת ADR-26 ו-ADR-27 |
| `spec/MILESTONES.md` | סימון 🟡 בסיום |

- **אין צורך בשינוי:** `next.config.ts`, ‏`proxy.ts` (‏`/api/cron/` כבר פתוח, והנתיב מאמת את הסוד בעצמו), ‏`.env.example` (אין משתנים חדשים), והסקריפטים.
- `maxDuration` כבר מוגדר: 300 לניתוח ו-60 לתזכורות.

**`cron-reminders.sql` — עיקרי הקובץ:**
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := '<APP_URL>/api/cron/reminders',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    timeout_milliseconds := 55000
  );
  $$
);
```
- `timeout_milliseconds`: ברירת המחדל קצרה מדי (כמה שניות), ושליחת כמה מיילים עלולה לקחת יותר. 55 שניות תואם ל-`maxDuration = 60`.
- הקובץ ב-GitHub מכיל רק את המילה `<APP_URL>` ואף סוד. את הכתובת האמיתית Claude נותן בשלב ההדבקה, ואת הסוד המשתמשת מכניסה ל-Vault בפקודה נפרדת שלא נשמרת בקובץ.

## 5. סדר העבודה
**הסדר הזה מחייב.** חיבור Vercel מפעיל פריסה מיד, כי הקוד של M7 כבר נמצא ב-`main` ב-GitHub. לכן ה-Database מוכן לפני החיבור, ומשתני הסביבה מוזנים לפני הפריסה הראשונה.

הדרכת המשתמשת נעשית שלב אחד בכל פעם בצ'אט. Claude ממתין לאישור שהשלב הסתיים לפני שממשיכים.

### שלב 0 — הכנה (Claude, בלי Push)
1. יצירת הקבצים מסעיף 4.
2. הרצת ה-Migration החדש על Development (`npm run db:migrate`).
3. `npm run lint` ו-`npm run build`.
4. בדיקה בדפדפן ב-Development עם משתמש הבדיקה: רשימות, פתיחת מכרז, עריכה, סימון "בוצע" והפעלה ידנית של התזכורות. המטרה: לוודא שהאפליקציה עובדת בלי גישת `anon`.
5. בדיקה חוזרת שאין סודות בקוד ובהיסטוריה של Git (בדיקה ראשונית בתכנון: נקי, ורק `.env.example` עוקב ב-Git).

### שלב 1 — יצירת `tenders-prod` (המשתמשת, בהדרכה)
- לוודא שיש מקום לפרויקט חינמי שני (ADR-8).
- יצירת פרויקט בשם `tenders-prod`, **באותו אזור של `tenders-dev`**. עדיף אזור באירופה, כי הוא הקרוב ביותר לישראל. אם `tenders-dev` נמצא באזור אחר, בודקים יחד.
- אם מופיעה האפשרות "Automatically expose new tables" — משאירים כבויה. ה-Migration מסעיף 2 מטפל בהרשאות.
- שמירת סיסמת ה-Database במקום בטוח של המשתמשת. לא בקובץ בפרויקט ולא בצ'אט.

### שלב 2 — הרצת ה-Migrations (המשתמשת, אחרי אישור)
- לפי ADR-3: הדבקה ב-SQL Editor של Production, **קובץ אחד בכל פעם, לפי הסדר**, 11 קבצים.
- Claude אומר איזה קובץ הבא, ופותח אותו.
- אחרי הקובץ האחרון: הדבקת `verify.sql`. התוצאה הנכונה: 11 שורות ב-`app_migrations`, והרשאות ל-14 טבלאות.
- אם קובץ נכשל: עוצרים ובודקים יחד. ה-Database ריק בשלב הזה, ולכן אפשר לתקן ולהריץ שוב בלי סיכון לנתונים.

### שלב 3 — הגדרות Auth, חלק ראשון (המשתמשת, בהדרכה)
- יצירת המשתמשת עם סיסמה חזקה (Add user, עם אישור אוטומטי של המייל).
- כיבוי `Allow new users to sign up`.
- Custom SMTP: ‏`smtp.gmail.com`, פורט 465, אותו חשבון Gmail ו-App Password, ושם שולח "ניהול מכרזים".
- Reset Password: הדבקת התבנית מ-`supabase/email-templates/reset-password.html` והנושא "איפוס סיסמה · ניהול מכרזים".

### שלב 4 — חיבור Vercel (המשתמשת, בהדרכה)
- כניסה ל-Vercel עם חשבון GitHub, תוכנית Hobby, ויבוא ה-Repository `sagit239/TenderProj`.
- **לפני** לחיצה על Deploy, הזנת משתני הסביבה הבאים. ה-Project Name קובע את הכתובת, ולכן בוחרים אותו עכשיו.

| משתנה | ערך |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | מ-`tenders-prod` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` מ-`tenders-prod` |
| `SUPABASE_SERVICE_ROLE_KEY` | `sb_secret_...` מ-`tenders-prod` |
| `OPENAI_API_KEY` | אותו מפתח |
| `OPENAI_MODEL` | `gpt-6.1-sol` |
| `GMAIL_USER` | כמו ב-`.env` |
| `GMAIL_APP_PASSWORD` | כמו ב-`.env` |
| `NOTIFY_EMAIL` | כמו ב-`.env` |
| `CRON_SECRET` | **סוד חדש**, לא זה של Development |
| `APP_URL` | `https://<שם-הפרויקט>.vercel.app` |

- `SUPABASE_DB_URL` **לא** נכנס ל-Vercel: הוא מקומי בלבד. גם ערכים מ-`.env.test.local` לא נכנסים.
- יצירת הסוד החדש: Claude נותן פקודה שהמשתמשת מריצה אצלה. הערך לא מודבק בצ'אט.
- `NEXT_PUBLIC_...` נכנסים לקוד בזמן ה-Build, ולכן חובה שיוזנו לפני הפריסה. אם משהו חסר או שגוי: מתקנים ומריצים Redeploy.
- אם הכתובת שהתקבלה שונה מ-`APP_URL`: מעדכנים את המשתנה ומריצים Redeploy.
- אזור השרת: אם Vercel מאפשר בתוכנית Hobby לבחור אזור, בוחרים את האזור הקרוב ל-Supabase. לא אומת בזמן התכנון, ונבדק במסך עצמו. המערכת תעבוד גם בלי זה, רק מעט לאט יותר.

### שלב 5 — הגדרות Auth, חלק שני (המשתמשת, בהדרכה)
- Site URL = כתובת Vercel.
- Redirect URLs: ‏`<כתובת>/auth/confirm` ו-`<כתובת>/reset-password`.
- בדיקה: "שכחתי סיסמה" שולח מייל, הקישור עובד גם בטלפון, והסיסמה החדשה עובדת.

### שלב 6 — הפעלת ה-Cron (המשתמשת, בהדרכה)
1. שמירת הסוד ב-Vault, ב-SQL Editor: `select vault.create_secret('<הסוד>', 'cron_secret');`
2. הדבקת `cron-reminders.sql` עם הכתובת האמיתית.
3. Claude בודק מבחוץ שקריאה לנתיב בלי סוד נדחית (401).
4. אחרי 15 דקות: `verify.sql` מראה ריצה מוצלחת ותשובה 200.
- כל ההרחבות מופעלות ב-SQL עצמו, ואין צורך בלחיצות נוספות. אם Supabase דוחה זאת, מפעילים ב-Database → Extensions.

### שלב 7 — בדיקת OpenAI (המשתמשת, בהדרכה)
- בדיקה שתקרת ההוצאה החודשית (Budget) עדיין מוגדרת ומתאימה. הערכה: כ-$0.40 לניתוח.
- בדיקה שאפשרות שיתוף המידע עם OpenAI לשיפור מודלים כבויה (דרישת פרטיות מ-ARCHITECTURE).

### שלב 8 — בדיקת קצה (המשתמשת, עם רשימה מ-Claude)
הזרימה מסעיף 6. משתמשים במכרז לדוגמה, ובאיש צוות עם הכתובת של המשתמשת, כדי שלא יישלחו מיילי בדיקה לעובדים.
אחרי הבדיקה מוחקים את מכרז הבדיקה ומזינים את אנשי הצוות האמיתיים.

### שלב 9 — סיום
- Claude מסמן 🟡 ומציג את התוצאה מול ה-Definition of Done.
- "דחוף שינויים לגיטהאב": סימון ✅, ו-commit ו-push של קבצי M8. ה-Push הזה מפעיל פריסה נוספת, בלי שינוי בקוד האפליקציה. ה-Migration כבר רץ על Production בשלב 2, ולכן התנאי של ARCHITECTURE מתקיים.
- בודקים שהפריסה הזו עברה ב-Vercel.

## 6. בדיקות מול ה-Definition of Done
| תנאי | איך בודקים | מי |
|---|---|---|
| כל ה-Migrations רשומים ב-`app_migrations` של Production | `verify.sql`: ‏11 שורות | המשתמשת, Claude קורא את התוצאה |
| ההרצה התבצעה לפני הפריסה | סדר השלבים: 2 לפני 4 | Claude |
| כניסה עובדת ממחשב ומטלפון | כניסה בכתובת Vercel בשני המכשירים, ברשת הסלולרית בטלפון | המשתמשת |
| בדיקת קצה | יצירת מכרז עם קבצים ← ניתוח ← שיוך משימה ← "בוצע" ← מעבר ל"הוגש". בנוסף: "לוח בקרה" מתעדכן, ייצוא Word ו-PDF, ושליחה במייל | המשתמשת |
| ה-Cron רץ כל 15 דקות | `verify.sql` מראה ריצות מוצלחות בפער של 15 דקות | המשתמשת, Claude קורא את התוצאה |
| תזכורת בדיקה נשלחת אוטומטית | מועד "אחר" בלוח הזמנים עם אחראי ועם מועד תזכורת בעוד כ-20 דקות. המייל מגיע בלי שום הפעלה ידנית | המשתמשת |
| אין סודות ב-GitHub | סריקת הקוד וההיסטוריה לפני ה-Push הסופי | Claude |
| תקרת ההוצאה מוגדרת | שלב 7 | המשתמשת |

**גבולות הבדיקה של Claude ב-Production:** Claude לא מתחבר למערכת ב-Production, לא מזין סיסמאות או מפתחות, ולא פונה ל-Database של Production. הוא בודק מבחוץ רק כתובות ציבוריות: שמסך ההתחברות נטען, ושקריאה בלי סוד נדחית. כל השאר נבדק על ידי המשתמשת, ו-Claude קורא תוצאות שהיא מדביקה. **מפתחות וסיסמאות לא מדביקים בצ'אט.**

## 7. עדכון מסמכים בזמן הבנייה
- **ADR-26: הרשאות מפורשות לטבלאות.** למה זה נדרש, למה `anon` בחוץ, והכלל שכל טבלה חדשה צריכה `grant`.
- **ADR-27: מפתחות Supabase החדשים תחת שמות המשתנים הקיימים.**
- שינויים ב-ARCHITECTURE שמעבר ל-ADRs לא נעשים בלי לשאול.

## 8. סיכונים ונקודות לתשומת לב
- **הרשאות בפרויקט חדש:** אי אפשר לבדוק לפני יצירת `tenders-prod`, כי ב-Development יש ברירת מחדל ישנה ואין מקום לפרויקט חינמי שלישי. `verify.sql` ובדיקת הקצה מכסים זאת, ו-Production ריק עד אז, ולכן תיקון לא מסכן נתונים.
- **Vercel Hobby וחיבור ל-GitHub:** ידוע ש-Hobby עלול לחסום פריסה כשכותב ה-commit אינו בעל החשבון. כותב ה-commits כאן הוא `sagit239`, אבל הם כוללים גם שורת Co-Authored-By. לא אומת אם זה משפיע. אם פריסה נחסמת, מטפלים בזה לפי ההודעה ב-Vercel.
- **Gmail משרת של Vercel:** בדיקה ראשונה של שליחה משרת ב-Vercel, ולא מהמחשב. נבדק בשלבים 5 ו-8. אם Google חוסמת, מאשרים את הפעילות בחשבון ה-Gmail.
- **קריאת קבצים ב-Vercel:** המרת Word ו-Excel וקריאת PDF נבדקו רק מקומית. בבדיקת הקצה מעלים גם PDF, גם Word וגם Excel.
- **מסכי Vercel ו-Supabase משתנים מדי פעם:** אם מסך שונה מההדרכה, המשתמשת מתארת מה היא רואה ו-Claude מתאים את ההדרכה.
- **שימוש מסחרי ב-Hobby:** החלטה קיימת (ADR-4), בלי שינוי.

## 9. מקורות
- [Supabase — טבלאות לא נחשפות אוטומטית](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)
- [Supabase — API keys](https://supabase.com/docs/guides/api/api-keys.md)
- [Supabase — Scheduling with pg_cron, pg_net ו-Vault](https://supabase.com/docs/guides/functions/schedule-functions)
- [Vercel — Functions limits](https://vercel.com/docs/functions/limitations)
