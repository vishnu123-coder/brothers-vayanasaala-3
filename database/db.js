// database/db.js
// Shared cloud database (Cloud Firestore via the NATIVE React Native Firebase
// SDK, with offline persistence).
//
// DESIGN NOTES
//  * Books, members and active issues are each kept in a live, in-memory
//    "store" fed by a Firestore snapshot listener. After the first load the
//    phone only downloads CHANGES, searching is instant and works offline,
//    and every screen updates automatically when another phone adds a book.
//  * Writes never hang the UI when offline: they are saved locally at once
//    and synced later (see settle()).
import firebase from '@react-native-firebase/app';
import { db as firestore, firestoreStatic } from './firebaseConfig';
import { decorateBook } from '../utils/search';
import { todayStr, addDaysStr } from '../utils/dates';
import { CATEGORIES, LANGUAGES, LOAN_DAYS } from './constants';

export { CATEGORIES, LANGUAGES, LOAN_DAYS };

const booksCol = firestore.collection('books');
const membersCol = firestore.collection('members');
const issuesCol = firestore.collection('issues');
const countersRef = firestore.collection('meta').doc('counters');

// ---------------------------------------------------------------- helpers

const CHUNK = 400; // Firestore allows max 500 writes per batch

function chunk(arr, size = CHUNK) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Firestore write promises only resolve once the SERVER confirms. Offline
// that can be never — so after a short wait we treat the write as "queued"
// (it is already saved locally and will sync by itself). Real errors, such
// as permission-denied, still reject.
async function settle(promise, ms = 3500) {
  let timer;
  const queued = new Promise((resolve) => {
    timer = setTimeout(() => resolve('queued'), ms);
  });
  try {
    return await Promise.race([promise.then(() => 'synced'), queued]);
  } finally {
    clearTimeout(timer);
  }
}

// Firestore document IDs cannot contain "/".
const memberDocId = (memberId) => String(memberId).trim().replace(/\//g, '_');

// ---------------------------------------------------------------- live stores

function createLiveStore(buildQuery, normalize) {
  let snap = {
    data: [],
    loading: true,
    error: null,
    fromCache: true,
    hasPendingWrites: false,
  };
  const listeners = new Set();
  let unsub = null;

  const emit = () => listeners.forEach((l) => l());

  const start = () => {
    if (unsub) return;
    try {
      unsub = buildQuery().onSnapshot(
        { includeMetadataChanges: true },
        (s) => {
          snap = {
            data: s.docs.map((d) => normalize(d.data(), d)),
            loading: false,
            error: null,
            fromCache: s.metadata.fromCache,
            hasPendingWrites: s.metadata.hasPendingWrites,
          };
          emit();
        },
        (err) => {
          unsub = null;
          snap = { ...snap, loading: false, error: err };
          emit();
        }
      );
    } catch (err) {
      unsub = null;
      snap = { ...snap, loading: false, error: err };
      emit();
    }
  };

  return {
    start,
    subscribe(listener) {
      listeners.add(listener);
      start();
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snap,
    // Re-attach the listener (used by pull-to-refresh / "Retry").
    refresh() {
      if (unsub) {
        unsub();
        unsub = null;
      }
      snap = { ...snap, loading: true, error: null };
      emit();
      start();
    },
  };
}

export const booksStore = createLiveStore(() => booksCol, (data) => decorateBook(data));
export const membersStore = createLiveStore(() => membersCol, (data) => data);
export const activeIssuesStore = createLiveStore(
  () => issuesCol.where('status', '==', 'issued'),
  (data, d) => ({ id: d.id, ...data })
);

// ---------------------------------------------------------------- setup

export async function initDatabase() {
  // Start listening straight away so data is warm by the time screens open.
  booksStore.start();
  membersStore.start();
  activeIssuesStore.start();

  // Make sure the counters document exists. Never block or crash the app if
  // this fails (e.g. first launch while offline) — screens show their own
  // status and the counter is created on the next successful launch.
  try {
    const snap = await withTimeout(countersRef.get(), 3000, 'timeout');
    if (!snap.exists) {
      await settle(countersRef.set({ nextBookId: 1, categoryCounters: {} }, { merge: true }));
    }
  } catch (e) {
    /* non-fatal */
  }
  return true;
}

// ---------------------------------------------------------------- auto-numbering

export async function getNextBookId() {
  try {
    const snap = await countersRef.get();
    return (snap.exists && snap.data().nextBookId) || 1;
  } catch (e) {
    return null;
  }
}

export async function getNextCategoryNo(categoryCode) {
  try {
    const snap = await countersRef.get();
    const data = snap.exists ? snap.data() : {};
    return ((data.categoryCounters || {})[categoryCode] || 0) + 1;
  } catch (e) {
    return null;
  }
}

// Reserves the next Book ID + Category No atomically, so two phones adding a
// book at the same moment never collide. (Needs an internet connection.)
async function reserveNumbers(categoryCode) {
  return withTimeout(
    firestore.runTransaction(async (tx) => {
      const snap = await tx.get(countersRef);
      const data = snap.exists ? snap.data() : {};
      const bookId = data.nextBookId || 1;
      const categoryCounters = { ...(data.categoryCounters || {}) };
      const categoryNo = (categoryCounters[categoryCode] || 0) + 1;
      categoryCounters[categoryCode] = categoryNo;
      tx.set(countersRef, { nextBookId: bookId + 1, categoryCounters }, { merge: true });
      return { bookId, categoryNo };
    }),
    12000,
    'Could not reach the server to assign a Book ID. Check your internet connection and try again.'
  );
}

// ---------------------------------------------------------------- books

function bookDoc({ bookId, categoryCode, categoryNo, categoryType, bookName, authorName, publicationName, cost, barcode, status, createdAt }) {
  return {
    book_id: bookId,
    category_code: categoryCode,
    category_no: categoryNo,
    category_type: categoryType || null,
    book_name: bookName,
    author_name: authorName || null,
    publication_name: publicationName || null,
    cost: cost || null,
    barcode: barcode || null,
    status: status || 'available',
    created_at: createdAt || new Date().toISOString(),
  };
}

export async function addBook({ categoryCode, categoryType, bookName, authorName, publicationName, cost, barcode }) {
  const { bookId, categoryNo } = await reserveNumbers(categoryCode);
  await settle(
    booksCol.doc(String(bookId)).set(
      bookDoc({ bookId, categoryCode, categoryNo, categoryType, bookName, authorName, publicationName, cost, barcode })
    )
  );
  return { bookId, categoryNo };
}

// Imports many books fast: ONE transaction reserves every number needed, then
// the books are written in batches of 400 (the old version did one slow
// transaction per book).
//  - rows that carry their own Book ID + Category No (a real register) keep
//    those exact numbers
//  - other rows get fresh numbers automatically
export async function bulkImportLibraryBooks(rows, onProgress) {
  const failed = [];
  if (!rows.length) return { inserted: 0, failed };

  const explicit = rows.filter((r) => r.bookId && r.categoryNo);
  const auto = rows.filter((r) => !(r.bookId && r.categoryNo));

  // Reserve numbers in a single transaction.
  const assigned = await withTimeout(
    firestore.runTransaction(async (tx) => {
      const snap = await tx.get(countersRef);
      const data = snap.exists ? snap.data() : {};
      let nextId = data.nextBookId || 1;
      const cc = { ...(data.categoryCounters || {}) };

      for (const r of explicit) {
        if (r.bookId >= nextId) nextId = r.bookId + 1;
        if (r.categoryNo > (cc[r.categoryCode] || 0)) cc[r.categoryCode] = r.categoryNo;
      }
      const autoAssigned = auto.map((r) => {
        const categoryNo = (cc[r.categoryCode] || 0) + 1;
        cc[r.categoryCode] = categoryNo;
        return { ...r, bookId: nextId++, categoryNo };
      });
      tx.set(countersRef, { nextBookId: nextId, categoryCounters: cc }, { merge: true });
      return [...explicit, ...autoAssigned];
    }),
    20000,
    'Could not reach the server to assign Book IDs. Check your internet connection and try again.'
  );

  // Preserve "issued" status of books that already exist (re-importing a register).
  const existingStatus = {};
  const snapNow = booksStore.getSnapshot();
  if (snapNow.data.length) {
    snapNow.data.forEach((b) => {
      existingStatus[b.book_id] = b.status;
    });
  }

  let inserted = 0;
  const batches = chunk(assigned);
  for (let i = 0; i < batches.length; i += 1) {
    const part = batches[i];
    try {
      const batch = firestore.batch();
      part.forEach((r) => {
        batch.set(
          booksCol.doc(String(r.bookId)),
          bookDoc({ ...r, status: existingStatus[r.bookId] || 'available' })
        );
      });
      await settle(batch.commit(), 6000);
      inserted += part.length;
    } catch (e) {
      part.forEach((row) => failed.push({ row, error: e.message }));
    }
    if (onProgress) onProgress(Math.min((i + 1) * CHUNK, assigned.length), assigned.length);
  }
  return { inserted, failed };
}

export async function getAllBooks() {
  const snap = await booksCol.get();
  const rows = snap.docs.map((d) => d.data());
  rows.sort((a, b) => a.book_id - b.book_id);
  return rows;
}

// Instant lookup from the in-memory store (barcode first, then Book ID).
export function findBookLocal(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const { data } = booksStore.getSnapshot();
  const lower = v.toLowerCase();
  const byBarcode = data.find((b) => b.barcode && String(b.barcode).toLowerCase() === lower);
  if (byBarcode) return byBarcode;
  const n = Number(v.replace(/^#/, ''));
  if (!isNaN(n)) return data.find((b) => b.book_id === n) || null;
  return null;
}

export async function findBookByBarcodeOrId(value) {
  const v = String(value ?? '').trim();
  if (!v) return null;
  const local = findBookLocal(v);
  if (local) return local;

  // Fallback to the server/cache in case the live store hasn't loaded yet.
  const byBarcode = await booksCol.where('barcode', '==', v).limit(1).get();
  if (!byBarcode.empty) return byBarcode.docs[0].data();
  const numeric = Number(v.replace(/^#/, ''));
  if (!isNaN(numeric)) {
    const byId = await booksCol.doc(String(numeric)).get();
    if (byId.exists) return byId.data();
  }
  return null;
}

// Deletes a single book. Blocked while the book is issued so issue history
// never points at a missing book.
export async function deleteBook(bookId) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found');
  if (book.status === 'issued') {
    throw new Error('This book is currently issued. Return it before deleting.');
  }
  await settle(booksCol.doc(String(book.book_id)).delete());
  return book;
}

// ---------------------------------------------------------------- members

export async function addMember({ memberId, name, phone, address }) {
  const ref = membersCol.doc(memberDocId(memberId));
  const existing = await ref.get();
  if (existing.exists) {
    const err = new Error('A member with this Member ID already exists.');
    err.code = 'member-exists';
    throw err;
  }
  await settle(
    ref.set({
      member_id: String(memberId).trim(),
      name: name || null,
      phone: phone || null,
      address: address || null,
      created_at: new Date().toISOString(),
    })
  );
}

export async function getMember(memberId) {
  const snap = await membersCol.doc(memberDocId(memberId)).get();
  return snap.exists ? snap.data() : null;
}

export async function getAllMembers() {
  const snap = await membersCol.get();
  return snap.docs.map((d) => d.data());
}

export async function bulkImportMembers(rows) {
  const failed = [];
  const valid = [];
  rows.forEach((row) => {
    if (!row.memberId) failed.push({ row, error: 'Missing Member ID' });
    else valid.push(row);
  });

  let inserted = 0;
  for (const part of chunk(valid)) {
    try {
      const batch = firestore.batch();
      part.forEach((r) => {
        batch.set(
          membersCol.doc(memberDocId(r.memberId)),
          {
            member_id: String(r.memberId).trim(),
            name: r.name || '',
            phone: r.phone || '',
            address: r.address || '',
          },
          { merge: true }
        );
      });
      await settle(batch.commit(), 6000);
      inserted += part.length;
    } catch (e) {
      part.forEach((row) => failed.push({ row, error: e.message }));
    }
  }
  return { inserted, failed };
}

// Blocked while the member holds an issued book.
export async function deleteMember(memberId) {
  const id = String(memberId).trim();
  const active = activeIssuesStore.getSnapshot().data.some((i) => i.member_id === id);
  if (active) {
    throw new Error('This member currently has a book issued. Return it before deleting.');
  }
  await settle(membersCol.doc(memberDocId(id)).delete());
}

// ---------------------------------------------------------------- issue / return

export async function issueBook({ memberId, bookId }) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found. Check the Book ID or barcode.');
  if (book.status === 'issued') throw new Error('This book is already issued.');

  const issueDate = todayStr();
  const dueDate = addDaysStr(LOAN_DAYS);

  // One atomic batch: the issue record and the book's status change together.
  const batch = firestore.batch();
  batch.set(issuesCol.doc(), {
    member_id: String(memberId).trim(),
    book_id: book.book_id,
    issue_date: issueDate,
    due_date: dueDate,
    return_date: null,
    status: 'issued',
  });
  batch.set(booksCol.doc(String(book.book_id)), { status: 'issued' }, { merge: true });
  await settle(batch.commit());

  return { issueDate, dueDate, book };
}

export async function returnBook({ bookId }) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found. Check the Book ID or barcode.');
  if (book.status !== 'issued') throw new Error('This book is not currently issued.');

  const returnDate = todayStr();

  let issueDocId = null;
  const local = activeIssuesStore.getSnapshot().data.find((i) => i.book_id === book.book_id);
  if (local) {
    issueDocId = local.id;
  } else {
    const snap = await issuesCol
      .where('book_id', '==', book.book_id)
      .where('status', '==', 'issued')
      .limit(1)
      .get();
    if (!snap.empty) issueDocId = snap.docs[0].id;
  }

  const batch = firestore.batch();
  if (issueDocId) {
    batch.set(issuesCol.doc(issueDocId), { return_date: returnDate, status: 'returned' }, { merge: true });
  }
  batch.set(booksCol.doc(String(book.book_id)), { status: 'available' }, { merge: true });
  await settle(batch.commit());

  return { returnDate, book };
}

export async function getAllIssuesFull() {
  const snap = await issuesCol.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------------------------------------------------------------- backup / restore

export async function getBackupData() {
  const [books, members, issues] = await Promise.all([getAllBooks(), getAllMembers(), getAllIssuesFull()]);
  return { books, members, issues };
}

async function deleteCollection(col) {
  const snap = await col.get();
  for (const part of chunk(snap.docs)) {
    const batch = firestore.batch();
    part.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export async function clearAllData() {
  for (const col of [booksCol, membersCol, issuesCol]) {
    await deleteCollection(col);
  }
  await countersRef.set({ nextBookId: 1, categoryCounters: {} });
  return true;
}

// Restores from a full backup. Written in batches of 400 — the old version
// crashed on libraries bigger than 500 records.
export async function restoreFullBackup({ books = [], members = [], issues = [] }, onProgress) {
  const cleanBooks = books
    .map((b) => ({ ...b, book_id: Number(b.book_id), category_no: Number(b.category_no) || 0 }))
    .filter((b) => b.book_id && b.book_name);
  const cleanMembers = members.filter((m) => m.member_id !== null && m.member_id !== undefined && String(m.member_id).trim() !== '');
  const cleanIssues = issues.filter((i) => i.book_id !== null && i.member_id !== null);

  await clearAllData();

  let maxBookId = 0;
  const categoryCounters = {};
  cleanBooks.forEach((b) => {
    if (b.book_id > maxBookId) maxBookId = b.book_id;
    if (b.category_no > (categoryCounters[b.category_code] || 0)) categoryCounters[b.category_code] = b.category_no;
  });

  const total = cleanBooks.length + cleanMembers.length + cleanIssues.length;
  let done = 0;
  const tick = (n) => {
    done += n;
    if (onProgress) onProgress(done, total);
  };

  for (const part of chunk(cleanBooks)) {
    const batch = firestore.batch();
    part.forEach((b) => {
      batch.set(
        booksCol.doc(String(b.book_id)),
        bookDoc({
          bookId: b.book_id,
          categoryCode: b.category_code,
          categoryNo: b.category_no,
          categoryType: b.category_type,
          bookName: String(b.book_name),
          authorName: b.author_name,
          publicationName: b.publication_name,
          cost: b.cost,
          barcode: b.barcode !== null && b.barcode !== undefined ? String(b.barcode) : null,
          status: b.status,
          createdAt: b.created_at,
        })
      );
    });
    await batch.commit();
    tick(part.length);
  }

  for (const part of chunk(cleanMembers)) {
    const batch = firestore.batch();
    part.forEach((m) => {
      batch.set(membersCol.doc(memberDocId(m.member_id)), {
        member_id: String(m.member_id).trim(),
        name: m.name || null,
        phone: m.phone !== null && m.phone !== undefined ? String(m.phone) : null,
        address: m.address || null,
        created_at: m.created_at || new Date().toISOString(),
      });
    });
    await batch.commit();
    tick(part.length);
  }

  for (const part of chunk(cleanIssues)) {
    const batch = firestore.batch();
    part.forEach((i) => {
      batch.set(issuesCol.doc(), {
        member_id: String(i.member_id),
        book_id: Number(i.book_id),
        issue_date: i.issue_date,
        due_date: i.due_date,
        return_date: i.return_date || null,
        status: i.status || 'issued',
      });
    });
    await batch.commit();
    tick(part.length);
  }

  await countersRef.set({ nextBookId: maxBookId + 1, categoryCounters });
  return { books: cleanBooks.length, members: cleanMembers.length, issues: cleanIssues.length };
}

// ---------------------------------------------------------------- firebase diagnostics

export function getFirebaseInfo() {
  try {
    const opts = firebase.app().options || {};
    return { projectId: opts.projectId || 'unknown', appId: opts.appId || 'unknown' };
  } catch (e) {
    return { projectId: 'unavailable', appId: 'unavailable' };
  }
}

const ERROR_HINTS = {
  'firestore/permission-denied':
    'Firestore security rules are blocking the app. In Firebase Console → Firestore Database → Rules, allow read/write. If you used "test mode", those rules EXPIRE after 30 days.',
  'firestore/unavailable': 'No internet connection, or Google servers are unreachable.',
  'firestore/not-found':
    'The Firestore database has not been created yet. Firebase Console → Firestore Database → Create database.',
  'firestore/failed-precondition': 'Firestore rejected the request (a missing index or an unsupported setup).',
  'firestore/unauthenticated': 'Firebase refused the request as unauthenticated — check the rules.',
};

// Real end-to-end test: reads AND writes a document on the Firebase server
// (bypassing the phone's local cache) and reports exactly what happened.
export async function testFirebaseConnection() {
  const info = getFirebaseInfo();
  const result = { ...info, read: null, write: null, latencyMs: null, hint: '' };
  const started = Date.now();

  try {
    await withTimeout(countersRef.get({ source: 'server' }), 10000, 'timeout');
    result.read = 'ok';
    result.latencyMs = Date.now() - started;
  } catch (e) {
    result.read = e.message === 'timeout' ? 'timeout' : e.code || e.message;
    result.hint =
      e.message === 'timeout'
        ? 'The server did not answer in time — the phone is probably offline.'
        : ERROR_HINTS[e.code] || e.message;
    result.ok = false;
    return result;
  }

  try {
    await withTimeout(
      firestore
        .collection('meta')
        .doc('health')
        .set({ last_check: firestoreStatic.FieldValue.serverTimestamp() }, { merge: true }),
      10000,
      'timeout'
    );
    result.write = 'ok';
  } catch (e) {
    result.write = e.message === 'timeout' ? 'timeout' : e.code || e.message;
    result.hint = ERROR_HINTS[e.code] || 'Write test failed.';
  }

  result.ok = result.read === 'ok' && result.write === 'ok';
  return result;
}

export default firestore;
