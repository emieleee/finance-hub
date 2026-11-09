# Finance Hub: Phase 3 Setup Guide

This phase adds four things:

| Feature | Needs setup from you? |
|---|---|
| Installable app, offline mode and update banner | Upload the files (Part 1) |
| Data checks in the database rules | Paste the new rules (Part 2) |
| Firebase App Check | Optional, about 15 min (Part 4) |
| Google Drive backups | Optional, about 15 min (Part 5) |

The **monthly backup reminder** works right away. Without Part 5, backups download to your device. With it, they save to Google Drive.

> **Before you start:** open the current app and go to **Settings → Download backup (JSON)**.

---

## Part 1: Upload the new files

Upload these to your `finance-hub` repository. Use a new branch and pull request as usual.

```
index.html
sw.js
manifest.webmanifest
icons/              (the whole folder, 5 PNG files)
```

1. In the repo, go to **Add file → Upload files**.
2. Drag in `index.html`, `sw.js`, `manifest.webmanifest` **and the `icons` folder**. Dragging the folder keeps its structure.
3. Choose **Create a new branch… and start a pull request**, then **Propose changes**, then **Merge**.
4. Wait about 1 minute, then open the site and press **Ctrl+F5** on PC. This is the **last time you'll need Ctrl+F5**.

**Check:** the repo shows `icons/icon-192.png` and the other icon files inside an `icons` folder.

---

## Part 2: Database rules with data checks

The new rules keep your email lock and also check every save:

- Amounts must be numbers.
- Dates must be real `YYYY-MM-DD` dates.
- Text has length limits.
- Records can't contain unexpected fields.

1. Open the `firestore.rules` file Claude gave you and copy everything.
2. **Replace `YOUR_EMAIL@gmail.com`** with the Gmail address you sign in with. It must match exactly.
3. In Firebase, go to **Firestore Database → Rules**, select everything, paste, then click **Publish**.
4. **Test it:** open the app, add a test expense (₱1), edit it, then delete it.
   - If you see **"Sync error: permission-denied"**, tell Claude which action caused it.
   - To undo quickly, the **Rules** tab has a history list where you can restore the previous version.

---

## Part 3: Install the app on your phone

**Android (Chrome):**

1. Open `https://emieleee.github.io/finance-hub/` and sign in.
2. Tap **⋮ → Install app** (or **Add to Home screen**). The app's **Settings → App** card may also show an **Install app** button.

**iPhone (Safari):** tap **Share → Add to Home Screen**. You'll need to sign in once inside the installed app.

**Offline test:** open the installed app once with internet, then turn on airplane mode and reopen it. Your data still shows, with the badge reading **Offline – will sync**. Anything you add syncs when you're back online.

**Updates from now on:** when you upload a new `index.html`, the open app shows **"New version available – Tap to refresh."** Tap it, and you're on the new version.

---

## Part 4: Firebase App Check (optional, recommended)

App Check blocks requests that don't come from your actual site, such as scripts calling your database directly.

### 4a. Create a reCAPTCHA v3 key

1. Go to **https://www.google.com/recaptcha/admin/create** and sign in with your personal Google account.
2. Fill in:
   - **Label:** `Finance Hub`
   - **Type:** **Score based (v3)**
   - **Domains:** `emieleee.github.io`
   - If asked for a Google Cloud project, pick **finance-hub-5373a**.
3. Click **Submit**. Copy the **Site key** and the **Secret key**.

### 4b. Register it in Firebase

1. In the Firebase console, go to **Security → App Check → Get started**.
2. In the **Apps** tab, click your web app, then **reCAPTCHA**. Paste the **Secret key** and click **Save**.

### 4c. Add the site key to the app

1. On GitHub, open `index.html` and click the **pencil (Edit)** icon.
2. Near the top of the main script, find:
   ```js
   recaptchaSiteKey:''
   ```
   Paste your **Site key** between the quotes, e.g. `recaptchaSiteKey:'6Lc…'`.
3. Commit the change, using a branch and pull request if you prefer.

### 4d. Turn on enforcement (after 1–2 days)

1. Use the app normally for a day or two.
2. In **App Check → APIs → Cloud Firestore**, check that almost all requests are **Verified**.
3. Click **Enforce**.

⚠️ **Don't enforce before step 4c is live,** or the app will be blocked. If something breaks, click **Unenforce**.

The small reCAPTCHA badge is hidden. The required notice is shown in **Settings → Account** instead.

---

## Part 5: Google Drive backups (optional)

Backups go to a **Finance Hub Backups** folder in your Drive. The app can only see files it created there, not the rest of your Drive.

1. Go to **https://console.cloud.google.com** and pick **finance-hub-5373a** in the project picker at the top.
2. Go to **APIs & Services → Library**, search for **Google Drive API**, and click **Enable**.
3. Go to **Google Auth Platform**, also called **OAuth consent screen**:
   - If prompted, click **Get started**. Enter app name `Finance Hub`, your Gmail as the support email, and **Audience: External**, then **Create**.
   - Under **Audience → Test users**, add **your Gmail**.
   - Under **Data access → Add or remove scopes**, add `https://www.googleapis.com/auth/drive.file`, then **Save**.
4. Go to **Clients** (or **APIs & Services → Credentials**) and open **Web client (auto created by Google Service)**:
   - Under **Authorized JavaScript origins**, click **Add URI** and enter `https://emieleee.github.io`, then **Save**.
   - Copy the **Client ID**. It ends with `.apps.googleusercontent.com`.
5. On GitHub, edit `index.html`, find `googleClientId:''` and paste the Client ID between the quotes. Commit.
6. In the app, go to **Settings → Backups → Save backups to: Google Drive → Back up now**.
   - Google asks for permission the first time. Because the app is in testing mode, you may see "Google hasn't verified this app". Click **Continue**, since it's your own app.
   - A small Google window may flash briefly on later backups. That's normal.

---

## How the backup reminder works

- If you have data and haven't backed up in **30 days** (or ever), Home shows: *"Your last backup was X days ago. [Back up now]"*.
- One tap saves to Google Drive (if set up) or downloads a file.
- The last backup date syncs across your devices, so backing up on your PC clears the reminder on your phone too.
- To turn the reminder off, go to **Settings → Backups** and untick **Remind me to back up every month**.

> **Why not fully automatic?** A backup that runs on its own while the app is closed needs a server (Firebase Cloud Functions), which requires Firebase's paid plan. The monthly one-tap reminder gets you most of the benefit for free.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Sync error: permission-denied" after Part 2 | Check the email in the rules matches exactly. Then tell Claude which action failed. You can restore the old rules from the Rules history. |
| No "Install app" option | Make sure the site loaded once over the internet. On Android Chrome, use **⋮ → Add to Home screen**. |
| Update banner never shows | It appears after you upload a new `index.html` and reopen or return to the app. Use **Settings → App → Check for updates**. |
| App blocked after enforcing App Check | Click **Unenforce**, confirm the site key is in `index.html`, then wait a day and try again. |
| Drive backup error "origin_mismatch" | Add `https://emieleee.github.io` to the client's Authorized JavaScript origins (Part 5, step 4). |
| Drive backup error "access_denied" | Add your Gmail as a test user (Part 5, step 3). |
