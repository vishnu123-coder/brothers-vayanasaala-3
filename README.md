# Brothers Vayanasala — Library Management System

A complete mobile app (Android/iOS) built with **React Native + Expo**, covering:

- 📊 **Dashboard** — total/issued/available book counts, breakdown by category, "due soon" list
- ➕ **Add Book** — barcode scanning, auto-generated Book ID (overall stock number) and Category No
  (per-category number, e.g. `N-20`), category dropdown, language dropdown, and **bulk Excel (.xlsx) import**
- 🔍 **Global Search** — filter by category, search by book name / author / publication
- 📚 **Total Stock View** — full list: Book ID, Category No, Book Name, Author, Publication, Cost
- 🔄 **Book Issue / Return** — scan/enter member ID and book ID, auto issue date, auto return-due
  date (issue date + 15 days)
- ☁️ **Database** — shared cloud database (Cloud Firestore) with offline support: works without internet and syncs automatically
- 💾 **Backup & Restore** — export your entire library (books, members, issue history) to a
  single `.xlsx` file, and restore it later — also accepts plain Excel/xlsx book lists

A starter logo/icon and splash screen are already included in `assets/`.

---

## 1. Install prerequisites (one-time)

You need [Node.js](https://nodejs.org/) (v18+) installed on your computer. You do **not** need
Android Studio for the recommended build method below.

```bash
npm install -g eas-cli
```

## 2. Install project dependencies

Unzip the project, then in the project folder run:

```bash
npm install
```

## 3. Try it instantly on your phone (no build needed)

1. Install the **Expo Go** app from the Play Store on your Android phone.
2. In the project folder, run:
   ```bash
   npx expo start
   ```
3. Scan the QR code shown in the terminal with the Expo Go app. The app will load live on your phone.

This is the fastest way to test everything (barcode scanner, database, Excel import) before
building the final APK.

## 4a. No Node.js / old computer (Windows 7, etc.)? Build entirely from the browser

If your computer can't run Node.js locally (e.g. Windows 7), you can still build the APK using
only GitHub + Expo's website — nothing installs on your computer, and the build itself runs on
Expo's servers.

1. Unzip this project, then upload the whole folder to a new GitHub repository (use GitHub's
   web "Add file → Upload files" — no git command needed).
2. Go to [expo.dev](https://expo.dev) and sign in (free account).
3. **Create a project → Import from GitHub**, and select your repo.
4. In the project dashboard, go to **Builds → Create a build** → platform **Android** →
   profile **preview** (this uses the `eas.json` already included here, which builds a plain
   installable `.apk`).
5. Start the build and wait ~10–15 minutes. The dashboard gives you a **Download** link/QR code.
6. Open that link on your **phone** (not your computer) and install the APK — you may need to
   allow "install unknown apps" once.

## 4b. Build the real, installable .apk file (if you do have Node.js)

This project uses **EAS Build**, Expo's free cloud build service — it compiles the APK on
Expo's servers, so you don't need Android Studio or the Android SDK installed locally.

```bash
eas login          # create a free account at expo.dev if you don't have one
eas build:configure
eas build -p android --profile preview
```

When it finishes (~10–15 minutes), EAS gives you a download link for the `.apk` file. Download
it to your phone (or send the link to yourself) and tap to install (you may need to allow
"Install unknown apps" for your browser/file manager once).

> The `preview` profile builds a standard installable APK. Use `--profile production` later if
> you want an `.aab` file for publishing to the Play Store instead.

### Alternative: build locally with Android Studio

If you'd rather build locally: install Android Studio + the Android SDK, run
`npx expo prebuild` to generate the native `android/` folder, then build with:
```bash
cd android && ./gradlew assembleRelease
```
The APK will appear under `android/app/build/outputs/apk/release/`.

---

## Backup & Restore

Found under the **Backup** tab (also reachable from the Dashboard quick actions):

- **Create Backup** — exports every book, member, and issue/return record into one `.xlsx`
  file with three sheets (`Books`, `Members`, `Issues`), then opens your phone's share sheet so
  you can save it to Google Drive, email it to yourself, etc.
- **Restore from File** — accepts two kinds of Excel files:
  - A **full backup** `.xlsx` (produced by "Create Backup" above, recognized by its Books +
    Issues sheets) — restoring this **replaces all current data** with an exact copy, including
    original Book IDs and issue history. You'll get a confirmation warning first.
  - A **plain book-list** `.xlsx`/`.xls` (the same format as the Add Book bulk-import template)
    — these are **added** as new books without touching existing data.

Restore auto-detects which kind of file you picked, so you don't need to choose a mode manually.

## Excel Import Format

Use the included `sample_book_import_template.xlsx` as a starting point. Columns (header row,
case-insensitive):

| categoryCode | categoryType | bookName | authorName | publicationName | cost | barcode |
|---|---|---|---|---|---|---|
| N | English | The Old Man and the Sea | Ernest Hemingway | Scribner | 350 | 9780684801223 |

- `categoryCode` must be one of: `N, S, P, R, OT, CL, B` (see below). Unrecognized codes fall
  back to `OT`.
- `barcode` is optional — leave blank if the book has no physical barcode yet.
- Book ID and Category No are generated automatically for every imported row; don't include them
  in the file.

## Category Codes

| Code | Meaning |
|---|---|
| N | Novel |
| S | Story |
| P | Poem |
| R | Reference |
| OT | Others |
| CL | Children's literature |
| B | Biography/Autobiography |

To add/rename categories or languages, edit `CATEGORIES` and `LANGUAGES` in `database/db.js`.

## Project Structure

```
Brothers Vayanasala/
├── App.js                     # Navigation + app entry
├── app.json                   # Expo app config (name, icon, permissions)
├── database/db.js             # SQLite schema + all queries (books, members, issues)
├── screens/
│   ├── DashboardScreen.js
│   ├── AddBookScreen.js       # incl. barcode scan + Excel import
│   ├── SearchScreen.js
│   ├── StockViewScreen.js
│   └── IssueReturnScreen.js
├── components/
│   └── BarcodeScannerModal.js
├── utils/theme.js             # Shared colors/spacing
├── assets/                    # icon.png, splash.png, adaptive-icon.png
└── sample_book_import_template.xlsx
```

## Notes / Things you may want to customize

- **Member records**: the current Issue screen accepts any Member ID as free text (scanned or
  typed) — there's a `members` table and `upsertMember()` helper already wired into `database/db.js`
  ready for you to add a full "Add Member" screen if you want to store member names/phone numbers.
- **Cost currency**: displayed as `₹` (rupee) — change the symbol in `SearchScreen.js` and
  `StockViewScreen.js` if needed.
- **Overdue alerts**: the Dashboard shows the 5 soonest-due active issues; you could extend this
  to highlight overdue ones in red by comparing `due_date` to today's date.
- **Barcode types supported**: EAN-13, EAN-8, Code128, Code39, UPC-A, UPC-E, QR — adjust in
  `BarcodeScannerModal.js` if your book barcodes use a different symbology.


---

## What changed in this version (v1 premium update)

- **Global Search rebuilt** — searches the *whole* library (no 500-book limit), instantly, even offline.
  Every word you type must match somewhere in the book (title, author, publisher, language,
  category, Book ID, `N-20` category numbers, barcode), in any order. Best matches first.
  Includes category / status filters and a barcode-scan button.
- **Results now sorted correctly** — Book IDs used to be ordered as text ("99" before "100").
- **Live data** — every screen updates by itself when another phone adds or issues a book.
- **Readable text** — body text is never below 13px, line-heights fit Malayalam/Hindi/Tamil glyphs,
  every input has explicit text/placeholder colours (no more invisible text), dropdown pickers
  replaced with tappable chips.
- **Any screen size** — layouts adapt from small phones to tablets; content is centred at a
  comfortable width; system font size is respected but capped so layouts never break.
- **5 clear bottom tabs** (Home, Search, Stock, Issue, More). Add Book, Members and Backup are in
  **More** (and on the Home quick-action grid).
- **Fixes** — backup/restore and Excel import work for libraries over 500 records, "Total books"
  stays correct after deleting, returning a book that is not issued no longer corrupts counts,
  issue/return dates use your local date (not UTC), duplicate member IDs are caught, member IDs
  containing `/` work, app opens even when the phone is offline.
- **Cloud status** — **More → Cloud status → Run connection test** really reads and writes your
  Firebase project and tells you exactly what is wrong if it fails. A small badge on every
  header shows Synced / Syncing / Offline / Error.

## Firebase checklist

1. `google-services.json` must belong to the Firebase project you want (currently `brothers-vayanasala-2`)
   and contain the Android package `com.brothersvayanasala.app` (same as `app.json`). ✔
2. In Firebase Console, **Firestore Database** must be created.
3. **Rules** must allow access — see `firestore.rules.example`. Test-mode rules expire after 30 days.
4. Firebase does **not** work in Expo Go. Install a real build (`eas build -p android --profile preview`).
