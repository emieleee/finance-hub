# Finance Hub: Web Deployment & Real-Time Sync Setup Guide

This guide takes you from the current Finance Hub to a live website on GitHub Pages with your data synced in real time between your phone and PC using Firebase.

**Total time:** about 30–40 minutes
**Cost:** free (no credit card needed)

---

## Overview

| Part | What you do | Who | Time |
|---|---|---|---|
| A | Back up your current data | You | 2 min |
| B | Create a GitHub account and repository | You | 5 min |
| C | Create and configure Firebase | You | 15 min |
| D | Send the setup details to Claude | You | 1 min |
| E | Connect the app to Firebase | Claude | — |
| F | Upload the app and turn on GitHub Pages | You | 5 min |
| G | First sign-in, import data, test sync | You | 5 min |

**How it fits together:**

```
 Phone browser ─┐                         ┌─ Firebase Authentication (Google sign-in)
                ├── github.io/finance-hub ┤
 PC browser ────┘   (the app's files)     └─ Firestore Database (your data, real-time)
```

GitHub only hosts the app's files. Your financial data lives in Firestore, and only your signed-in Google account can read or write it.

---

## Before you start

You'll need:

- A **personal Google account** (Gmail). Use this rather than your Genesys work account, since this is personal financial data.
- An email address for GitHub (your personal email is fine).
- A PC browser (Chrome or Edge recommended).
- About 30 minutes.

> **Tip:** Keep a Notepad file open while you go. You'll copy a few values (your GitHub username, the Firebase config) that Claude needs in Part D.

---

## Part A: Back up your current data

Do this first so nothing gets lost when we switch to cloud storage.

1. Open the current **Finance Hub** artifact (in the Cowork sidebar).
2. Click **Settings** in the side menu.
3. Under **Data**, click **Export backup (JSON)**.
4. A file named `finance-hub-backup-YYYY-MM-DD.json` downloads. Keep it somewhere safe, such as Documents. You'll import it in Part G.

✅ **Check:** the `.json` file is in your Downloads folder.

---

## Part B: Create your GitHub repository

### B1. Create a GitHub account (skip if you have one)

1. Go to **https://github.com/signup**.
2. Enter your email, a password and a **username**. Choose the username carefully: it becomes part of your web address (`https://USERNAME.github.io/...`).
3. Complete the verification and confirm your email.

📝 **Write down:** your GitHub username.

### B2. Create the repository

1. Sign in at **https://github.com**.
2. Click the **+** icon (top right), then **New repository**.
3. Fill in:
   - **Repository name:** `finance-hub`
   - **Description** (optional): `Personal finance tracker`
   - **Visibility:** **Public**. Free GitHub Pages requires a public repository. This is safe: the repository only contains the app's code. Your financial data stays in Firebase, protected by your sign-in.
   - Leave "Add a README" **unchecked**.
4. Click **Create repository**.
5. Leave this tab open. You'll upload the app here in Part F.

✅ **Check:** you see an empty repository page with "Quick setup" instructions.

Your future app address will be:
```
https://USERNAME.github.io/finance-hub/
```

---

## Part C: Set up Firebase

> **Newer Firebase layout:** the left menu groups products under **Product categories** (Databases & Storage, Security, etc.) instead of a single **Build** menu. If you can't find something, use **Search for products** at the top left.

> Firebase's screens change from time to time. If a button name doesn't match exactly, look for the closest equivalent; the steps stay the same.

### C1. Create a Firebase project

1. Go to **https://console.firebase.google.com**.
2. Sign in with your **personal Google account**.
3. Click **Create a project** (or **Add project**).
4. **Project name:** `finance-hub`. Firebase may add a code to the ID, e.g. `finance-hub-a1b2c`. That's fine.
5. Accept the terms and click **Continue**.
6. If asked about **Gemini in Firebase**, you can turn it off. It's not needed.
7. **Google Analytics:** turn it **off**. It's not needed for a personal app.
8. Click **Create project**, wait about 30 seconds, then click **Continue**.

✅ **Check:** you're on the project home page ("Project Overview").

### C2. Register the web app and get your config

1. On the Project Overview page, click the **Web icon `</>`**. It's labeled "Add app" or sits under "Get started by adding Firebase to your app".
2. **App nickname:** `Finance Hub Web`.
3. Leave **"Also set up Firebase Hosting"** **unchecked**. We're using GitHub Pages instead.
4. Click **Register app**.
5. Firebase shows a code block. Find the part that looks like this:
   ```js
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "finance-hub-a1b2c.firebaseapp.com",
     projectId: "finance-hub-a1b2c",
     storageBucket: "finance-hub-a1b2c.firebasestorage.app",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abc123def456"
   };
   ```
6. **Copy everything from `const firebaseConfig = {` to `};`** and paste it into your Notepad file.
7. Click **Continue to console**.

> **Is it safe to share this config?** Yes. These values only identify your project; they aren't passwords. Firebase is designed for this config to sit in public web pages. Your data is protected by the Security Rules in step C6.

> **Lost the config?** Click the ⚙️ gear next to "Project Overview", then **Project settings**, scroll to **Your apps**, and find the **SDK setup and configuration** box. Choose **Config** to see it again.

### C3. Turn on Google sign-in

1. In the left menu, under **Product categories**, expand **Security**, then click **Authentication**. In older layouts it's under **Build**; you can also type "Authentication" into **Search for products**.
2. Click **Get started**.
3. Open the **Sign-in method** tab.
4. Under "Native providers" or "Additional providers", click **Google**.
5. Toggle **Enable** on.
6. **Project support email:** pick your personal Gmail.
7. Click **Save**.

✅ **Check:** the Sign-in method list shows **Google: Enabled**.

### C4. Allow your GitHub Pages address

This tells Firebase that sign-in is allowed from your website.

1. Still in **Authentication**, open the **Settings** tab.
2. Click **Authorized domains**.
3. Click **Add domain**.
4. Enter **exactly** (no `https://`, no `/finance-hub`):
   ```
   USERNAME.github.io
   ```
   (Replace `USERNAME` with your GitHub username, all lowercase.)
5. Click **Add**.

✅ **Check:** the list shows `localhost`, `finance-hub-xxxx.firebaseapp.com`, and `USERNAME.github.io`.

### C5. Create the Firestore database

1. In the left menu, under **Product categories**, expand **Databases & Storage**, then click **Firestore**. In older layouts it's under **Build**; you can also type "Firestore" into **Search for products**.
2. Click **Create database**.
3. If asked to choose an edition, pick **Standard edition**.
4. **Database ID:** leave as `(default)`.
5. **Location:** choose **`asia-southeast1 (Singapore)`**. It's closest to the Philippines, so it's fastest for you. ⚠️ This **can't be changed later**.
6. Click **Next**.
7. Choose **Start in production mode**. This blocks all access until you add the rules in the next step.
8. Click **Create** (or **Enable**) and wait a few seconds.

✅ **Check:** you see an empty Firestore "Data" view.

### C6. Add the security rules (important)

These rules make sure **only your signed-in account** can read or write your data.

1. On the Firestore Database page, open the **Rules** tab.
2. **Delete everything** in the editor.
3. Paste this exactly:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. Click **Publish**.

**What these rules mean:** each person's data lives in its own folder, `users/<their account ID>/...`. A request is allowed only if the person is signed in and the folder is their own. Everyone else, including anyone who finds your website, gets "permission denied".

✅ **Check:** the Rules tab shows your new rules with a recent "Last published" time.

---

## Part D: Send the setup details to Claude

Reply in this chat with:

1. **Your GitHub username**
2. **Your `firebaseConfig` block** (from C2)

Example message:
```
GitHub username: emiele-ariola

const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};
```

---

## Part E: What Claude will build

Once Claude has your details, you'll get a new **`index.html`** with:

| Feature | What it does |
|---|---|
| **Google sign-in screen** | "Sign in with Google" on first visit; you stay signed in after that |
| **Real-time sync** | Changes on one device appear on others within about 1–2 seconds, without refreshing |
| **Offline mode** | Entries made without internet are saved on the device and sync automatically when you reconnect |
| **Sync status badge** | Shows 🟢 Synced, 🟡 Saving…, or ⚪ Offline |
| **Per-record saving** | Each entry is saved separately, so editing on two devices at once won't overwrite other entries |
| **Import to cloud** | One-time import of your backup file from Part A |
| **Empty start** | No personal numbers are built into the public file |
| **Sign out** | Under Settings |

---

## Part F: Upload the app and turn on GitHub Pages

### F1. Upload the file

1. Open your `finance-hub` repository on GitHub.
2. Click **"uploading an existing file"**. It's in the Quick setup box; or use **Add file → Upload files**.
3. Drag the **`index.html`** file Claude gave you into the upload area.
   - ⚠️ The file must be named exactly **`index.html`**.
4. Under "Commit changes", leave the message as is (or type `Initial upload`).
5. Click **Commit changes**.

✅ **Check:** the repository now lists `index.html`.

### F2. Turn on GitHub Pages

1. In the repository, click **Settings** (the tab with the gear, top of the repo).
2. In the left menu, click **Pages**.
3. Under **Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` and `/ (root)`
4. Click **Save**.
5. Wait 1–2 minutes, then refresh the page. A banner appears at the top: **"Your site is live at https://USERNAME.github.io/finance-hub/"**.

✅ **Check:** opening that link shows the Finance Hub sign-in screen.

---

## Part G: First sign-in, import your data, test sync

### G1. Sign in on your PC

1. Open `https://USERNAME.github.io/finance-hub/`.
2. Click **Sign in with Google** and choose your **personal** Google account (the same one used for Firebase isn't required, but is simplest).
3. You'll land on an empty dashboard.

### G2. Import your backup

1. Go to **Settings**, then **Import backup**.
2. Choose the `.json` file from Part A.
3. Confirm. Your income, expenses, savings, goals, budgets and starting balances upload to the cloud.

✅ **Check:** the dashboard shows the same numbers as before (e.g. Money in hand ₱6,864.39 if you haven't added entries since).

### G3. Set it up on your phone

1. On your phone, open **Chrome** (Android) or **Safari** (iPhone).
2. Go to `https://USERNAME.github.io/finance-hub/`.
3. Sign in with the **same Google account**.
4. Your data appears automatically.
5. **Add it to your home screen** so it opens like an app:
   - **Android (Chrome):** tap ⋮ menu, then **Add to Home screen**, then **Add**.
   - **iPhone (Safari):** tap the Share icon, then **Add to Home Screen**, then **Add**.

### G4. Test real-time sync

1. Open the app on your **PC** and **phone** at the same time.
2. On the phone, add a test expense (e.g. Food, ₱1).
3. Watch the PC. The expense and dashboard totals update within about 1–2 seconds.
4. Delete the test entry on the PC; it disappears from the phone.

🎉 **Done!** Your Finance Hub is live and synced.

---

## Updating the app later

When Claude gives you a new version of `index.html`:

1. Open your repository on GitHub.
2. Click **Add file**, then **Upload files**.
3. Drag in the new `index.html`. It replaces the old one.
4. Click **Commit changes**.
5. Wait about 1 minute, then refresh the site (on phone, close and reopen the app).

Your data is **not affected** by updates, because it lives in Firebase, not in the file.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| GitHub page shows **404** | Pages not finished, or file misnamed | Wait 2 minutes; make sure the file is named `index.html` and Pages uses `main` / `(root)` |
| **"auth/unauthorized-domain"** on sign-in | Domain not added in C4 | Add `USERNAME.github.io` under Authentication → Settings → Authorized domains (no `https://`) |
| Sign-in popup closes or does nothing | Popup blocked | Allow popups for `github.io` in browser settings; the app will also fall back to a redirect sign-in |
| Sign-in fails when opening the file from your computer | Google sign-in doesn't work on `file://` pages | Use the GitHub Pages link instead |
| **"Missing or insufficient permissions"** | Rules not published, or typo | Re-paste the rules from C6 and click **Publish** |
| Data not appearing on phone | Signed in with a different Google account | Sign out (Settings) and sign in with the same account as on PC |
| Old version still showing after an update | Browser cache | Hard refresh (Ctrl+F5 on PC); on phone, close the tab or app and reopen |
| Badge stuck on ⚪ Offline | No internet, or Firestore not created | Check connection; confirm C5 was completed |

---

## Security & privacy notes

- **Who can see your data?** Only someone signed in to **your** Google account. The website is public, but the data isn't.
- **What's public?** Only the app's code (`index.html`) and the Firebase config, which is designed to be public.
- **Protect your Google account.** Turn on 2-Step Verification at https://myaccount.google.com/security, since that account is now the key to your finance data.
- **Backups:** keep exporting a backup occasionally (Settings, then Export backup) as an extra safety copy.

---

## Free plan limits (for reference)

Firebase's free **Spark** plan is more than enough for personal use:

| Resource | Free daily limit | Typical personal use |
|---|---|---|
| Firestore reads | 50,000 / day | A few hundred |
| Firestore writes | 20,000 / day | A few dozen |
| Stored data | 1 GB total | Under 1 MB for years of entries |
| Authentication | Free for Google sign-in | 1 user |

GitHub Pages is free for public repositories.

---

## Checklist

- [ ] **A:** exported backup `.json`
- [ ] **B:** GitHub account and `finance-hub` repository created
- [ ] **C1:** Firebase project created
- [ ] **C2:** web app registered, `firebaseConfig` copied
- [ ] **C3:** Google sign-in enabled
- [ ] **C4:** `USERNAME.github.io` added to authorized domains
- [ ] **C5:** Firestore database created in `asia-southeast1`
- [ ] **C6:** security rules published
- [ ] **D:** GitHub username and config sent to Claude
- [ ] **F:** `index.html` uploaded, GitHub Pages enabled
- [ ] **G:** signed in, backup imported, phone set up, sync tested
