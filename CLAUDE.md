# Finance Hub: project notes for Claude

A personal finance tracker (PHP) for one user, built as a **static web app** hosted on **GitHub Pages** at `https://emieleee.github.io/finance-hub/`, with data in **Firebase** (Google sign-in + Firestore, real-time sync, offline). The app started as an Excel tracker (Financial Tracker, Expense Savings Tracker, Income Tracker, Goals Planner, Data Analysis sheets), and its calculations mirror those formulas.

## Files

| File | Purpose |
|---|---|
| `index.html` | App markup and the pre-paint theme bootstrap. No build step and no framework. |
| `styles.css` | App styles and theme variables. |
| `app.js` | Main classic script: state, calculations, rendering, UI behavior and backups. |
| `firebase.js` | Firebase module: App Check, Auth, Firestore and cloud listeners. |
| `sw.js` | Service worker. It serves the cached app shell instantly, revalidates `index.html` in the background, and posts `UPDATE_READY` to show the "New version available" banner. It caches Firebase/Chart.js libraries but **never** caches Firestore traffic. |
| `manifest.webmanifest` | PWA manifest (installable app, shortcut `?add=expense`). |
| `icons/` | 192/512/maskable icons, apple-touch-icon and favicon. |
| `firestore.rules` | Reference copy of the Firestore security rules. **Not deployed by GitHub**: paste it into Firebase console → Firestore → Rules. The real file has the owner's Gmail in place of `YOUR_EMAIL@gmail.com`. |

## Deploying

- **Process:** push or merge to `main` and GitHub Pages republishes in about 1 minute. Use a branch + PR for changes.
- **Updates reach users without a hard refresh:** the service worker re-checks `index.html`, `styles.css`, `app.js` and `firebase.js` (the `CODE_FILES` list in `sw.js`) and shows the update banner when any changes. If you add a new code file, add it to both `SHELL` and `CODE_FILES`. Bump the shell cache name in `sw.js` when shell files change; bump the library cache name when cached libraries change.
- **Firebase config is public on purpose.** Security comes from the rules (owner email lock + field validation) and from App Check.

## App structure

The file has three script blocks, in this order:

1. **Theme bootstrap** (in `<head>`). Sets `html[data-theme]` from `localStorage fh.theme` (`auto|light|dark`) before paint.
2. **`app.js` main classic script**, loaded before the Firebase module, with these sections in order:
   - `CONFIG`: `window.FH_CONFIG = { googleClientId, recaptchaSiteKey }`, plus `APP_VERSION`. Empty values switch features off.
   - `STATE`: `S` (all data), `EMPTY()`, `defaultWallets()`, `KINDS`, the loading/ready logic (skeleton until every snapshot has arrived), and the cloud hooks `window.onData`, `window.onMeta`, `onSignedIn`, `onSignedOut`, `setSync`.
   - `HELPERS`: formatting (`fmt`, `nice`, `short`), dates (ISO `YYYY-MM-DD` strings, `P()` parses to a local Date), `parseAmt` and `fmtAmtInput` (comma formatting in `.amt` inputs), `toast(msg, {label, fn})` for Undo actions.
   - **Calculations (mirror the original Excel formulas):** `payCycle`, `stdPayday`, `timing`, `periodRange`; wallets (`walletBal`, `wFlows`, `wOf`, `srcOf`, `srcToFields`); bills (`nextPayday`, `billState`, `upcomingBills`); `balances(asOf)`, `periodStats(a, b)`, `goalStats()`.
   - `ICONS & COMPONENTS`: `IC` (UI icons), `CI` (category icons), `catIcon`, `kpi`, `emptyState`, charts (Chart.js).
   - **Renderers:** `renderDash`, `renderCompare`, `renderUpcoming`, `renderHeat`, `renderChecklist`, `renderActivity` (grouped list via `buildItems` + `groupsHtml`), `renderBills`, `renderWallets`, `renderSavings`, `renderGoals`, `renderSettings`. `render()` dispatches based on `curTab`.
   - **Navigation:** `go(tab)`. Tabs are `dash`, `activity`, `bills`, `wallets`, `savings`, `goals`, `settings`. The desktop sidebar is `#nav`; the mobile bottom bar is `#mnav` (Home, Activity, +, Wallets, More).
   - **Sheets and dialogs:** forms live in hidden `#formStore` and are moved into `#sheet` by `openSheet()`. `askConfirm()` returns a Promise and replaces `confirm()`.
   - **Forms:** the `FORMS` map gives the form id, noun, title and numeric fields. `openForm(kind, rec, preset, seg)` and one generic submit handler write via `cPut`. `deleteRec` deletes with Undo. The quick-add sheet is `openQA(pre)`, also used for paying bills.
   - **Click handling:** one delegated click handler uses `data-*` attributes (`data-new`, `data-goto`, `data-billpay`, `data-heat`, and so on). Rows can be swiped on touch (right = edit, left = delete).
   - **Backups:** `backupDue()` drives the 30-day reminder. `downloadBackup()`, `backupToDrive()` (Google Identity Services token + Drive API, `drive.file` scope, "Finance Hub Backups" folder), `doBackup()`.
   - **PWA:** service worker registration, update banner (`#updBar`), install prompt, `?add=expense` shortcut.
3. **`firebase.js` Firebase module** (SDK 10.12.2 from gstatic). Sets up App Check (`ReCaptchaEnterpriseProvider`, aka Fraud Defense), Auth (Google popup with redirect fallback), and Firestore with a persistent local cache. Exposes `window.FB = { uid, put, putMeta, bulk, signIn, signOut }` and per-collection `onSnapshot` listeners that feed `onData` and `onMeta`. A listener `permission-denied` error signs the user out with an "account doesn't have access" message.

## Data model (Firestore)

The doc id is the record id (`uid()`). Records are stored **without** an `id` field; it's added on read.

```
users/{uid}/meta/state   { settings, lists, budget, wallets[] }
  settings: startDate, startCash(legacy), startOther, startGoal, sal15, sal30,
            lastBackup, lastBackupWhere('file'|'drive'), backupTo, backupRemind, driveFolder
  lists: { expense[], income[], savings[] }   ("Salary" and "Goal" are required)
  budget: { [expenseCategory]: number }
  wallets: [{ id, name, type: 'cash'|'ewallet'|'bank'|'credit', start }]   (credit start = amount owed)
users/{uid}/expenses/{id}  type, amount, date, paidFrom('Cash Balance'|'Goal Funds'), wallet, note, billId?, billMonth?('YYYY-MM')
users/{uid}/income/{id}    type, amount, date(''=pending), wallet, desc, covStart, covEnd, adjPay, note
users/{uid}/savings/{id}   action('Deposit'|'Withdrawal'), account, amount, date, wallet, note
users/{uid}/transfers/{id} from, to, amount, date, note
users/{uid}/bills/{id}     name, category, amount, dueDay(number 1-31), src(wallet id or '__goal'), status('Active'|'Paused'), created, skips['YYYY-MM']
users/{uid}/goals/{id}     name, target, date
users/{uid}/allocs/{id}    goal(goal id), amount, date, note
```

**If you add or rename a field, update `firestore.rules` too**, because the rules use `hasOnly`. Otherwise saves fail with `permission-denied`.

Key rules of the domain:

- **Money in hand** is the sum of non-credit wallet balances.
- **Credit card purchases** don't reduce cash. Paying the card is a transfer *to* the credit wallet.
- **Goal-funded expenses** (`paidFrom: 'Goal Funds'`) reduce Goal Funds, not wallets.
- **Paydays** are the 15th and the 30th (or month end if shorter). Pay periods: 1st–14th, 15th–payday eve, payday–14th.
- **Records without a `wallet`** (legacy) count against `defaultWallet()`, the first non-credit wallet.

## Conventions

- **Keep it static and dependency-light.** No build step or framework. Only allowed CDNs: jsDelivr (Chart.js, optional JSZip) and gstatic (Firebase). New libraries must be lazy-loaded.
- **Theming:** use the CSS variables (`--card`, `--ink`, `--muted`, `--line`, `--soft`, `--em`, and so on). Every new style must work in both `html[data-theme=light]` and `[data-theme=dark]`. Tinted backgrounds use `color-mix(... var(--card))`.
- **Responsive:** breakpoints are 1200 / 1100 (icon rail) / 900 / 760 (mobile: bottom nav, bottom sheets) / 380. Inputs are 16px on mobile, and tap targets are at least 44px.
- **Escape all user text** with `esc()` before inserting it into HTML.
- **No `confirm()` or `alert()`:** use `askConfirm`, and offer Undo toasts for deletes.
- **Locale:** en-PH currency formatting (`fmt`), with dates shown in en-US short style.

## Testing approach used so far

- **jsdom harness:**
  1. Strip the CDN `<script src>` and the Firebase module.
  2. Inject a mock `window.FB` that keeps an in-memory store and calls `onData`/`onMeta`.
  3. Stub `matchMedia`, `scrollTo` and `URL.createObjectURL`, and use `pretendToBeVisual: true` for `requestAnimationFrame`.
  4. Drive the UI by dispatching clicks and submits, then assert on text and state.
- **Sample-data sanity check:** start cash 8,429; expenses Food 101/140/130, Electric 1,793.61, Commute 400 on 2026-11-02; Other Income 1,000 → money in hand **₱6,864.39** (matches the original Excel).
- **Quick syntax check:** extract each `<script>` and run `node --check`.

## Status / roadmap

**Live:**
- **Setup:** email-locked rules, real-time sync, offline mode.
- **Money:** wallets and transfers, recurring bills with reminders, quick-add.
- **Insights:** spending calendar, safe-to-spend, vs-last-month comparison.
- **Activity:** feed with search and swipe, undo.
- **Polish:** dark mode, setup checklist.
- **App:** PWA with update banner, backup reminder and Drive backup (needs `googleClientId`), App Check (key set; enforce once metrics show ~100% verified).

**Pending (in suggested order):**
1. Finish Phase 3 setup: publish the rules, register App Check in Firebase, optional Drive client ID.
2. Expected salary entries: auto-create Pending salary on the 15th/30th.
3. Goal projections (funded-by date, needed per month).
4. Net worth over time chart; emergency fund coverage (months).
5. Budget per paycheck (split budgets between the 15th and 30th periods); year in review.
6. Smart categories from note keywords; reminders outside the app (email/push); split expenses / IOUs.
7. Later: APK via Capacitor (needs a native Google sign-in plugin); shared access (rules change); receipt photos.

**On hold:** Excel export in the original tracker layout. Approach: fill a cleaned copy of the original `.xlsx` at XML level with JSZip so charts and formulas survive.
