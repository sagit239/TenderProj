# תוכנית — Milestone 3: ניתוח המכרז ב-AI

> מבוסס על `MILESTONES.md` (Milestone 3), `PRD.md` (F4, F5, Edge Cases, Flows 2–3), `ARCHITECTURE.md` (OpenAI API, Data Model, Data Flow "העלאה וניתוח", ADR-6, ADR-15) ו-`DESIGN.md` (ראש מסך המכרז — מצב ניתוח; לשוניות סיכום דרישות, לוח זמנים, משימות, סעיפים בעייתיים, מסמכים; Badges קריאה; Toast).
> בונים על הקוד של M2: `app/(app)/tenders/[id]/page.tsx` (לשוניות), `TenderHeader`, `DocumentsTab`, `NewTenderForm`, `lib/tenders.ts`, `lib/tenders-storage.ts`, `components/ui/*`.

## 1. מה נכנס ומה לא

**נכנס:** בדיקה מקדימה (חשבון, מפתח, תקרה, ניתוח ניסיון והחלטה על מודל); טבלאות הניתוח וטבלת החגים; פגישת סגירת פינות אוטומטית; Endpoint הניתוח; חיווי "בניתוח…", פס כישלון עם "ניסיון חוזר" ופס "נקרא חלקית"; תוכן ארבע הלשוניות, **להצגה בלבד**; Badge "מצב קריאה" בלשונית "מסמכים"; עמודת "מועד הגשה" ב"מכרזים פעילים".

**לא נכנס (M4):** עריכה, הוספה ומחיקה של פריטים (כפתורי "+ הוספה", "✎ עריכה · 🗑 מחיקה" לא מוצגים); שיוך אחראים, "בוצע", עמודת "תזכורת", איחורים ו-Badge איחורים; סנכרון משימה↔מועד (חוץ מהפגישה האוטומטית); ניתוח מחדש, `analysis_proposals` ודוחות שינויים; טבלת `task_assignees`. תזכורות — M5. ייצוא ומייל — M6.

## 2. שלב 0 — בדיקה מקדימה (לפני כל קוד אחר)

1. **הדרכת המשתמשת, צעד אחר צעד:** שימוש במפתח ה-OpenAI הקיים שלה (‏`sk-proj-…`, ADR-15). בדיקה שיש יתרה בחשבון, הגדרת **תקרת הוצאה חודשית** (Budget) בפרויקט של המפתח, ובדיקה שהשיתוף של מידע עם OpenAI לשיפור המודלים כבוי. אחר כך הוספת `OPENAI_API_KEY` ל-`.env`. ‏`.env.example` כבר עודכן (`OPENAI_API_KEY`, `OPENAI_MODEL=gpt-6.1-sol`), והמשתמשת מוסיפה את שתי השורות ל-`.env` ומוחקת את שורות `ANTHROPIC_*`.
2. **אימות מגבלות ה-API מול התיעוד העדכני של OpenAI** (נבדק חלקית בתכנון, נובמבר 2026): מחירים (`gpt-6.1-sol` ‎$2/$10, ‏`gpt-6.1-terra` ‎$1/$5, ‏`gpt-6-astra` ‎$10/$50 למיליון Tokens); ‏PDF ב-Responses API נקרא כטקסט + תמונת כל עמוד (`detail`), עד 50MB לקובץ ולבקשה; Files API עם `purpose: user_data`, מחיקה ו-`expires_after`; פרטיות (לא מאמנים כברירת מחדל, שמירה עד 30 יום). נשאר לוודא בבנייה: Structured Outputs יחד עם `input_file` ו-Streaming במודל שנבחר, ו-`max_output_tokens` מתאים לתשובה ארוכה.
3. **קובצי דוגמה:** בתיקייה `samples/` (נמצאת ב-`.gitignore`) יש מכרז אמיתי, מכרז 6323 (אספקת פרוצדורות לניתוחי עמוד שדרה): חוברת המכרז (PDF עם טקסט, כ-35 עמודים) ונוסח ערבות הביצוע (Word). אין למשתמשת PDF סרוק ו-Excel של המכרז, ולכן Claude מכין אותם לבדיקה בתיקייה `samples/test/`: גרסה סרוקה (תמונות בלבד) של כמה עמודים מהחוברת, קובץ Excel קטן של כתב כמויות, קובץ פגום, וזוג קבצים קטן עם מועד סותר (לבדיקת סתירות, אם החוברת לא כוללת סתירה).
4. **ניתוח ניסיון:** הסקריפט `scripts/ai-trial.ts` (מורץ ב-`node --env-file=.env`, משתמש באותו `lib/ai` שהאפליקציה תשתמש בו, כך שהבדיקה בודקת את הקוד האמיתי) מנתח את הקבצים מ-`samples/`, ומדפיס: זמן כולל, Tokens קלט/פלט, עלות מחושבת, ומספר הפריטים מכל סוג. הפלט המלא נשמר בתיקיית ה-scratchpad לבדיקת איכות. מריצים על `gpt-6.1-sol`, ולהשוואה גם על `gpt-6.1-terra`.
5. **הצגה למשתמשת והחלטה:** זמן, עלות, איכות (דוגמאות מהתוצאה). אם הזמן מעל ~200 שניות (קרוב ל-300) — מחליטים יחד: `gpt-6.1-terra`, או פיצול הבקשה. ההחלטה מתועדת ב-ADR (השלמה ל-ADR-15), וב-`.env.example` מתעדכנת ברירת המחדל אם השתנתה.

> עד שהשלבים 1–5 הושלמו והמשתמשת החליטה — לא בונים את שאר ה-Milestone. בגלל זה `lib/ai` ו-`lib/files` נכתבים ראשונים (הם צריכים לסקריפט).

## 3. חבילות

| חבילה | שימוש |
|---|---|
| `openai` | Files API, ‏Responses API עם Streaming ו-Structured Outputs |
| `mammoth` | Word (docx) ← טקסט, עם כותרות ומספור סעיפים |
| `word-extractor` | Word ישן (‎.doc) ← טקסט. JavaScript בלבד, בלי התקנה במחשב, ועובד גם ב-Vercel |
| `xlsx` (SheetJS) | Excel ← טקסט (CSV לכל גיליון, עם שם הגיליון). מותקן מה-CDN הרשמי של SheetJS (‏`cdn.sheetjs.com`, גרסה 0.20.x), כי הגרסה ב-npm ישנה ויש בה פרצות ידועות |
| `@hebcal/core` (devDependency) | הפקת רשימת החגים פעם אחת לסקריפט, לא בזמן ריצה |

קובצי `.doc` (Word ישן) נקראים ב-`word-extractor` (החלטת המשתמשת). המגבלה: נשלף טקסט בלבד, ומספור סעיפים אוטומטי עלול לא להיקלט, ולכן ההפניה לסעיף בקובץ כזה עלולה להיות פחות מדויקת. אם יש למשתמשת קובץ ‎.doc אמיתי, בודקים אותו בבדיקה המקדימה.

## 4. Database — Migrations חדשים

### 4.1 `supabase/migrations/<ts>_m3_analysis.sql`

**הרחבת טבלאות קיימות:**
- `tenders`: ‏`analysis_status text not null default 'idle'` (check: `idle`/`running`/`done`/`failed`), ‏`analysis_started_at timestamptz`, ‏`analysis_error text`.
- `tender_documents`: ‏`read_warning text` (null = תקין; check: `partial`/`unreadable`), ‏`read_note text` (הסבר קצר לתצוגה, למשל "הקובץ מוגן בסיסמה"), ‏`analyzed_at timestamptz` (null = עדיין לא נותח).

**טבלאות חדשות** (כולן עם `tender_id … references tenders on delete cascade`, אינדקס על `tender_id`, `created_at`, ו-`is_manual boolean not null default false` היכן שמוגדר ב-Data Model):

| טבלה | עמודות |
|---|---|
| `requirements` | id, tender_id, text, sort_order, is_manual |
| `deadlines` | id, tender_id, type (check: `submission`, `bidders_meeting`, `clarification_questions`, `closing_meeting`, `other`), title, due_at timestamptz, has_time, source_refs jsonb default `[]`, is_manual, is_auto |
| `tasks` | id, tender_id, deadline_id (FK ל-`deadlines`, ‏`on delete set null`), title, type (סוגי המועדים + `regular`), due_at **nullable** (משימה רגילה שה-AI לא מצא לה תאריך), has_time, is_done default false, remind_at null, is_manual, sort_order |
| `issues` | id, tender_id, category (check: 8 הקטגוריות), title, explanation, source_refs jsonb, suggested_question, is_manual, sort_order |
| `analysis_runs` | id, tender_id, started_at, finished_at, status (`running`/`done`/`failed`), error, model, input_tokens, output_tokens, change_report jsonb null (ימולא ב-M4) |
| `holidays` | date PK, name |

`source_refs`: מערך של `{file_name, page, section}` (‏`page` ריק ב-Word/Excel).

RLS: ‏`enable row level security` ומדיניות `authenticated full access` בכל הטבלאות, כמו ב-M1/M2. ‏`holidays`: קריאה בלבד ל-`authenticated`.

**פונקציות SQL:**
- `is_workday(d date)` — לא שישי, לא שבת, לא ב-`holidays`.
- `workdays_before(d date, n int)` — היום ה-n'י אחורה שהוא יום עבודה.
- `israel_ts(d date, t time)` — ממיר תאריך+שעה בשעון ישראל ל-`timestamptz`. בלי שעה ← 08:00.
- `start_analysis(p_tender uuid)` — **הגנה מהפעלה כפולה, באופן אטומי**: מעדכן ל-`running` רק אם המכרז לא `running` שהתחיל לפני פחות מ-5 דקות; יוצר `analysis_runs` ומחזיר את ה-id שלו, או null אם כבר רץ ניתוח. ב-M3 הוא גם דוחה מכרז שכבר יש לו ניתוח מוצלח (ניתוח מחדש = M4).
- `save_analysis(p_run uuid, p_result jsonb)` — שומר **בטרנזקציה אחת** את כל הפריטים, את מצב הקריאה של כל קובץ, את ה-Tokens, ומסמן `done` במכרז ובריצה. כך אין מצב של שמירה חלקית.
- `fail_analysis(p_run uuid, p_error text)` — מסמן `failed` במכרז ובריצה.

**Trigger — פגישת סגירת פינות** (`after insert/update/delete` על `deadlines` כשה-type הוא `submission`):
- מועד ההגשה הקובע = מועד ההגשה המוקדם ביותר של המכרז.
- תאריך הפגישה = `workdays_before(תאריך ההגשה בשעון ישראל, 3)`, ‏`has_time = false` (נשמר 08:00).
- אין פגישה אוטומטית ← יוצרים מועד `closing_meeting` ‏(`is_auto = true`, כותרת "פגישת סגירת פינות") ומשימה מקושרת "פגישת סגירת פינות" מסוג `closing_meeting`.
- יש פגישה אוטומטית שלא נערכה (`is_manual = false`) ← מזיזים אותה ואת המשימה המקושרת. נערכה ← לא נוגעים.
- אין יותר מועד הגשה ← מוחקים פגישה אוטומטית שלא נערכה (ואת המשימה שלה).

### 4.2 `supabase/migrations/<ts>_m3_holidays.sql`
- נוצר בסקריפט חד-פעמי `scripts/generate-holidays.mjs` (‏`@hebcal/core`, ישראל, 2026–2031).
- ימים שאינם ימי עבודה: ראש השנה (2 ימים), יום כיפור, סוכות (יום ראשון), שמיני עצרת/שמחת תורה, פסח (ראשון ושביעי), שבועות, יום העצמאות. **הרשימה (כולל השאלה אם ערבי חג וחול המועד נחשבים ימי עבודה) מוצגת למשתמשת לאישור לפני שמריצים את ה-Migration** (ADR-6).

שני הקבצים מורצים ב-`npm run db:migrate` על Development בלבד, ובסוף כל אחד רישום ב-`app_migrations`.

## 5. קוד צד שרת

| קובץ | תוכן |
|---|---|
| `lib/db/admin.ts` (חדש) | לקוח Supabase עם `SUPABASE_SERVICE_ROLE_KEY`, לשרת בלבד (`import "server-only"`). משמש את הניתוח שרץ ברקע |
| `lib/files/index.ts` (חדש) | `loadDocument(doc)` — מוריד מ-Storage. PDF ← נשאר כמו שהוא. docx ← `mammoth` לטקסט. ‏doc ← `word-extractor` לטקסט. xlsx/xls ← טקסט עם `=== גיליון: <שם> ===` לכל גיליון. קובץ פגום או מוגן בסיסמה ← מחזיר "לא נקרא" עם הסבר, בלי לזרוק שגיאה |
| `lib/ai/schema.ts` (חדש) | JSON Schema של התשובה (ראו למטה), וטיפוסי TypeScript תואמים |
| `lib/ai/prompt.ts` (חדש) | הנחיות המערכת בעברית: תפקיד, 8 הקטגוריות והגדרתן, סוגי המועדים, כללי ההפניות (שם קובץ מדויק מתוך הרשימה, עמוד ב-PDF, סעיף/גיליון ב-Word/Excel), סתירות בין מסמכים כולל מועדים סותרים, סיכום **קצר**, משימות שנגזרות מהדרישות (למשל "הכנת ערבות הגשה"), כל הטקסט בעברית |
| `lib/ai/analyze.ts` (חדש) | `analyzeTender(files)`: מעלה כל PDF ל-Files API (‏`purpose: user_data`, עם `expires_after` כגיבוי), ושולח **בקשה אחת** ב-Responses API, ב-Streaming ועם Structured Outputs (‏`json_schema`, ‏`strict`). לפני כל מסמך מופיעה שורת טקסט עם שם הקובץ המקורי. ‏PDF מצורף כ-`input_file`, ו-Word/Excel כטקסט. מחזיר את ה-JSON ואת ה-Tokens. ב-`finally` — מוחק את כל הקבצים מ-OpenAI. Timeout פנימי של ~280 שניות (AbortController). המודל מ-`OPENAI_MODEL`. זו נקודת המגע היחידה עם OpenAI |
| `app/api/tenders/[id]/analyze/route.ts` (חדש) | ראו למטה |

**מבנה התשובה (Structured Outputs):**
```
requirements[]: { text }
deadlines[]:    { key, type, title, date "YYYY-MM-DD", time "HH:MM" | null, source_refs[] }
tasks[]:        { title, deadline_key | null, date | null, time | null }
issues[]:       { category, title, explanation, source_refs[], suggested_question }
documents[]:    { file_name, read_quality: "full" | "partial" | "none", note }
```
- `key` מאפשר למשימה להפנות למועד בתוך אותה תשובה.
- `documents[]` הוא הדרך של המודל לדווח על PDF סרוק שחלקים בו לא זוהו (`partial`) — זה מקור ה-Badge "נקרא חלקית".

**`POST /api/tenders/[id]/analyze`** (‏`maxDuration = 300`):
1. מאמת שיש משתמשת מחוברת (לקוח השרת הרגיל). אחרת 401.
2. קורא ל-`start_analysis`. אם קיבל null ← 409 ("ניתוח כבר רץ").
3. מחזיר **מיד** 202, וממשיך לעבוד ברקע עם `after()` של Next.js (נתמך ב-Vercel עד `maxDuration`). כך הדפדפן לא צריך להישאר מחובר, והמשתמשת יכולה לעבור למסכים אחרים.
4. ברקע (לקוח admin): שולף את המסמכים, ממיר, שולח ל-`analyzeTender` רק את הקבצים שנקראו, ושומר ב-`save_analysis`:
   - קבצים שלא נקראו בהמרה ← `read_warning = unreadable`, עם `read_note`. המודל מדווח `partial`/`none` ← `partial`/`unreadable`.
   - מועדים: `date` + `time` ← `israel_ts` (בלי שעה ← 08:00, ‏`has_time = false`).
   - **משימה מקושרת לכל מועד** שה-AI מצא (`submission`, `bidders_meeting`, `clarification_questions`, `other`), מסוג המועד ובאותו תאריך — כדי שלכל מועד יהיו תזכורות לפי הסוג ב-M5. משימות ה-AI עם `deadline_key` מתמזגות עם המשימה המקושרת במקום ליצור כפילות; השאר הן `regular`.
   - הפגישה האוטומטית נוצרת מה-Trigger.
   - `source_refs.file_name` שלא תואם לשם קובץ קיים — נשמר כפי שהוא (ההפניה היא לאימות בלבד, ראו "דיוק ההפניות" ב-ARCHITECTURE).
5. כל שגיאה (מפתח שגוי, Timeout, תשובה לא תקינה, אין אף קובץ קריא) ← `fail_analysis` עם הודעה טכנית קצרה ללוג; למשתמשת מוצגת הודעה ידידותית קבועה.

## 6. ממשק

### 6.1 הפעלת הניתוח
- `NewTenderForm`: אחרי העלאת הקבצים, אם לפחות קובץ אחד עלה — `fetch` ל-`/analyze` (לא מחכים לסיום), ואז מעבר למסך המכרז. אם אף קובץ לא עלה — כמו היום, ללשונית "מסמכים".
- `DocumentsTab`: כפתור אדום **"ניתוח המסמכים"** — מוצג רק כשיש קבצים ועדיין אין ניתוח מוצלח (למשל מכרז שהקבצים שלו לא עלו בפעם הראשונה, או מכרזים שנוצרו ב-M2). ב-M4 הוא יוחלף ב"ניתוח מחדש" שבעיצוב.

### 6.2 מצב ניתוח — `components/tenders/AnalysisBanner.tsx` (חדש, Client)
מוצג מתחת ללשוניות, לפי `analysis_status`:
- **רץ** (‏`running` שהתחיל לפני פחות מ-5 דקות): פס Surface עם סמל טעינה ו-**"בניתוח… זה יכול לקחת כמה דקות. אפשר לעבור למסכים אחרים בינתיים."** (‏`role="status"`). בודק את המצב כל 5 שניות, ובסיום `router.refresh()` ו-Toast "הניתוח הסתיים".
- **נכשל**, או `running` מעל 5 דקות: פס Red Tint — **"הניתוח לא הצליח. הקבצים נשמרו."** וכפתור **"ניסיון חוזר"** (קורא שוב ל-`/analyze`).
- **הסתיים, וחלק מהקבצים `partial`/`unreadable`**: פס כתום בהיר — **"חלק מהמסמכים נקראו חלקית, ולכן הניתוח עלול להיות חלקי."** וקישור **"פרטים"** ללשונית "מסמכים".
- בזמן ניתוח, כפתור "ניתוח המסמכים" מושבת.

### 6.3 הלשוניות — `app/(app)/tenders/[id]/page.tsx`
הדף שולף את הנתונים של הלשונית הפעילה בלבד. לפני ניתוח — המצב הריק הקיים ("…יופיע כאן אחרי ניתוח המכרז"). בזמן ניתוח — "הניתוח עדיין רץ".

| לשונית | קומפוננטה חדשה | תוכן |
|---|---|---|
| סיכום דרישות | `RequirementsTab.tsx` | כותרת "סיכום דרישות המכרז", כרטיס לבן עם רשימת תבליטים לפי `sort_order` |
| לוח זמנים | `TimelineTab.tsx` | כותרת "מועדי המכרז". טבלה: מועד \| סוג \| תאריך ושעה \| מקור, ממוינת לפי תאריך. מועד בלי שעה ← תאריך + "שעה לא צוינה" ב-Muted. מקור: `חוזה.pdf · עמ' 3, סעיף 1.4` (שם הקובץ LTR); אוטומטי ← "אוטומטי (3 ימי עבודה לפני ההגשה)". **אין מועדים** ← "לא נמצאו מועדים במסמכי המכרז." בנייד: כרטיסים |
| משימות | `TasksTab.tsx` | כותרת "משימות". טבלה להצגה בלבד: משימה \| מועד (משימה בלי תאריך ← "—"). בנייד: כרטיסים |
| סעיפים בעייתיים | `IssuesTab.tsx` | כרטיסים: תגית קטגוריה (אדום על Red Tint), כותרת מודגשת, הפניות משמאל באפור (כמה הפניות מופרדות ב-" / "), הסבר Muted, תיבת Surface "שאלת הבהרה מוצעת: …" עם כפתור קטן **"העתקה"** (`navigator.clipboard`, Toast "ההעתקה הצליחה"). אין סעיפים ← "לא נמצאו סעיפים בעייתיים." |
| מסמכים | `DocumentsTab.tsx` (עדכון) | עמודה חדשה **"מצב קריאה"**: "נקרא" (Done על ירוק בהיר), "נקרא חלקית" (Warning), "לא נקרא" (אדום על Red Tint), ו-"—" לקובץ שעוד לא נותח. ה-`read_note` מוצג כטקסט Muted קטן מתחת לשם הקובץ. בנייד: בתוך הכרטיס |

קוד משותף:
- `lib/analysis.ts` (חדש): תוויות בעברית לסוגי מועדים ולקטגוריות, `formatSourceRef()`, ‏`formatDue(due_at, has_time)` לפי `Asia/Jerusalem`, ו-`isAnalysisStale()`.
- `lib/types.ts`: ‏`Requirement`, `Deadline`, `Task`, `Issue`, `SourceRef`, `AnalysisStatus`, והרחבת `Tender` ו-`TenderDocument`.
- `components/tenders/Tags.tsx`: ‏`CategoryTag` ו-`ReadBadge`.

### 6.4 "מכרזים פעילים"
עמודת "מועד הגשה" מציגה את מועד ההגשה המוקדם ביותר (מ-`deadlines`), במקום "—". "משימות פתוחות" נשארת "—" עד M4.

## 7. תיעוד
- **ADR-15** (כבר נכתב: OpenAI במקום Claude): השלמה של המודל שנבחר בבדיקה המקדימה, עם הזמן והעלות שנמדדו.
- **ADR-16:** הניתוח רץ ברקע (`after()`) ומחזיר 202, והדפדפן בודק את המצב כל כמה שניות.
- **ADR-17:** לכל מועד שה-AI מצא נוצרת משימה מקושרת מאותו סוג; שמירת התוצאות בפונקציית SQL אחת (טרנזקציה).
- `.gitignore`: הוספת `samples/`.
- `CLAUDE.md` — "פקודות הרצה": אם נוסף סקריפט הרצה (`ai-trial`), להוסיף שורה.

## 8. סדר הבנייה
1. שלב 0 (סעיף 2): הדרכת המשתמשת והמפתח, אימות ה-API, `lib/files` + `lib/ai` + `scripts/ai-trial.ts`, ניתוח ניסיון, **עצירה להחלטה על המודל**.
2. הפקת רשימת החגים ← **אישור המשתמשת**.
3. Migrations והרצתם על Development.
4. `lib/db/admin.ts`, Endpoint הניתוח.
5. `AnalysisBanner`, הפעלה מ"מכרז חדש" ומ"מסמכים".
6. ארבע הלשוניות, מצב קריאה, עמודת מועד הגשה.
7. בדיקות (סעיף 9), `npm run lint`, `npm run build`, ADRs, סימון 🟡.

## 9. בדיקות מול ה-Definition of Done
בדיקה ב-Browser Pane עם משתמשת הבדיקה של Claude (‏`.env.test.local`), מול Development בלבד:

| תנאי | איך בודקים |
|---|---|
| Migrations הורצו, מפתח ותקרה מוגדרים | `npm run db:migrate` מציג את שני הקבצים ב-`app_migrations`; המשתמשת מאשרת שהמפתח בתוך `.env` והתקרה הוגדרה |
| בדיקה מקדימה הוצגה ותועדה | ADR-15 כולל את המודל שנבחר ואת המדידות |
| ניתוח של 4 סוגי הקבצים | מכרז חדש מקובצי `samples/` ← "בניתוח…" ← ארבע הלשוניות מלאות בעברית |
| סעיף בעייתי מלא + "העתקה" | בדיקת כרטיס; לחיצה על "העתקה" וקריאת הלוח |
| סתירה בין מסמכים | קיים כרטיס "סתירות בין מסמכים" עם 2 הפניות (אם המכרז האמיתי לא כולל סתירה — זוג קבצים קטן שנוצר לבדיקה עם מועד סותר) |
| פגישת סגירת פינות | בדיקות SQL: הגשה ביום ראשון ← הפגישה ביום שלישי הקודם (חמישי, רביעי, שלישי); הגשה אחרי חג ← החג מדולג; הזזת מועד ההגשה מזיזה את הפגישה |
| קובץ פגום לא עוצר | מכרז עם קובץ פגום + קובץ תקין ← הניתוח מסתיים, הקובץ מסומן "לא נקרא", מוצג הפס הכתום |
| כשל ← הודעה וניסיון חוזר | הרצה זמנית עם מודל לא קיים ב-`OPENAI_MODEL` (בלי לגעת ב-`.env`: משתנה סביבה בהרצת הבדיקה) ← פס אדום ← "ניסיון חוזר" אחרי החזרת המודל מצליח |
| הפעלה כפולה נחסמת | שתי קריאות מהירות ל-`/analyze` ← השנייה מקבלת 409 |
| מחיקה מ-Files API | אחרי ניתוח, ב-Files API של OpenAI לא נשארו קבצים של הניתוח (סקריפט קצר עם ה-SDK) |
| נייד 375px | כל הלשוניות: כרטיסים, בלי גלילה לרוחב |

## 10. נקודות שבהן עוצרים ושואלים את המשתמשת
- המפתח של OpenAI ב-`.env` ותקרת ההוצאה בחשבון (שלב 0).
- קובצי הדוגמה ב-`samples/`.
- ההחלטה על המודל אחרי הניתוח הניסיוני.
- אישור רשימת החגים.
