// database/db.js
// Shared cloud database using the NATIVE React Native Firebase SDK — this
// has real offline persistence built into the phone: data typed in while
// fully offline (even from a cold app start) is saved locally immediately
// and synced automatically once the connection returns.
//
// Every function here keeps the EXACT same name/signature as before, so
// none of the screens need to change.
import { db as firestore, firestoreStatic } from './firebaseConfig';

export const CATEGORIES = [
  { code: 'N', label: 'Novel', short: 'Novel', color: '#2563EB' },
  { code: 'S', label: 'Story', short: 'Story', color: '#0D9488' },
  { code: 'P', label: 'Poem', short: 'Poem', color: '#9333EA' },
  { code: 'R', label: 'Reference', short: 'Reference', color: '#B45309' },
  { code: 'OT', label: 'Others', short: 'Others', color: '#6B7280' },
  { code: 'CL', label: "Children's literature", short: "Children's", color: '#DB2777' },
  { code: 'B', label: 'Biography/Autobiography', short: 'Biography', color: '#065F46' },
  { code: 'E', label: 'Essay / Memoir', short: 'Essay', color: '#7C3AED' },
  { code: 'SD', label: 'Story-Drama', short: 'Drama', color: '#EA580C' },
];

export const LANGUAGES = ['English', 'Hindi', 'Malayalam', 'Tamil', 'Kannada', 'Telugu', 'Other'];

const booksCol = firestore.collection('books');
const membersCol = firestore.collection('members');
const issuesCol = firestore.collection('issues');
const countersRef = firestore.collection('meta').doc('counters');

// ---------- Setup ----------

export async function initDatabase() {
  const snap = await countersRef.get();
  if (!snap.exists) {
    await countersRef.set({ nextBookId: 1, categoryCounters: {}, issuedCount: 0 });
  }
  return true;
}

// ---------- Auto-numbering (atomic, safe across multiple phones at once) ----------

export async function getNextBookId() {
  const snap = await countersRef.get();
  const data = snap.exists ? snap.data() : { nextBookId: 1 };
  return data.nextBookId || 1;
}

export async function getNextCategoryNo(categoryCode) {
  const snap = await countersRef.get();
  const data = snap.exists ? snap.data() : { categoryCounters: {} };
  return ((data.categoryCounters || {})[categoryCode] || 0) + 1;
}

// Reserves the next Book ID + Category No in one atomic transaction, so two
// phones adding a book at the same moment never collide.
async function reserveNumbers(categoryCode) {
  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(countersRef);
    const data = snap.exists ? snap.data() : { nextBookId: 1, categoryCounters: {} };
    const bookId = data.nextBookId || 1;
    const categoryCounters = { ...(data.categoryCounters || {}) };
    const categoryNo = (categoryCounters[categoryCode] || 0) + 1;
    categoryCounters[categoryCode] = categoryNo;
    tx.set(countersRef, { nextBookId: bookId + 1, categoryCounters }, { merge: true });
    return { bookId, categoryNo };
  });
}

// Makes sure future auto-numbering never collides with an explicitly-set
// number (used after importing a real register with existing stock numbers).
async function bumpCountersIfNeeded(bookId, categoryCode, categoryNo) {
  await firestore.runTransaction(async (tx) => {
    const snap = await tx.get(countersRef);
    const data = snap.exists ? snap.data() : { nextBookId: 1, categoryCounters: {} };
    const categoryCounters = { ...(data.categoryCounters || {}) };
    const updates = {};
    if (bookId >= (data.nextBookId || 1)) updates.nextBookId = bookId + 1;
    if (categoryNo > (categoryCounters[categoryCode] || 0)) {
      categoryCounters[categoryCode] = categoryNo;
      updates.categoryCounters = categoryCounters;
    }
    if (Object.keys(updates).length) tx.set(countersRef, updates, { merge: true });
  });
}

// ---------- Books ----------

export async function addBook({
  categoryCode,
  categoryType,
  bookName,
  authorName,
  publicationName,
  cost,
  barcode,
}) {
  const { bookId, categoryNo } = await reserveNumbers(categoryCode);
  await booksCol.doc(String(bookId)).set({
    book_id: bookId,
    category_code: categoryCode,
    category_no: categoryNo,
    category_type: categoryType || null,
    book_name: bookName,
    author_name: authorName || null,
    publication_name: publicationName || null,
    cost: cost || null,
    barcode: barcode || null,
    status: 'available',
    created_at: new Date().toISOString(),
  });
  return { bookId, categoryNo };
}

export async function bulkAddBooks(rows) {
  let inserted = 0;
  let failed = [];
  for (const row of rows) {
    try {
      await addBook(row);
      inserted += 1;
    } catch (e) {
      failed.push({ row, error: e.message });
    }
  }
  return { inserted, failed };
}

// Inserts a book with EXACT existing numbers (used when importing a real
// library register that already has physical Book ID / Category No labels).
export async function addBookExplicit({
  bookId,
  categoryCode,
  categoryNo,
  categoryType,
  bookName,
  authorName,
  publicationName,
  cost,
  barcode,
}) {
  const existing = await booksCol.doc(String(bookId)).get();
  const status = existing.exists ? existing.data().status : 'available';
  await booksCol.doc(String(bookId)).set({
    book_id: bookId,
    category_code: categoryCode,
    category_no: categoryNo,
    category_type: categoryType || null,
    book_name: bookName,
    author_name: authorName || null,
    publication_name: publicationName || null,
    cost: cost || null,
    barcode: barcode || null,
    status,
  });
  await bumpCountersIfNeeded(bookId, categoryCode, categoryNo);
}

export async function bulkImportLibraryBooks(rows) {
  let inserted = 0;
  let failed = [];
  for (const row of rows) {
    try {
      if (row.bookId && row.categoryNo) {
        await addBookExplicit(row);
      } else {
        await addBook(row);
      }
      inserted += 1;
    } catch (e) {
      failed.push({ row, error: e.message });
    }
  }
  return { inserted, failed };
}

export async function getAllBooks() {
  const snap = await booksCol.get();
  const rows = snap.docs.map((d) => d.data());
  rows.sort((a, b) => b.book_id - a.book_id);
  return rows;
}

export async function searchBooks({ query: q, categoryCode, status, pageSize = 30, cursor = null }) {
  const needle = (q || '').trim().toLowerCase();

  // Free-text search can't be done server-side in Firestore, so we scan a
  // BOUNDED window (still respecting any category/status filter) instead of
  // the entire collection — cost stays capped no matter how big the library
  // grows.
  if (needle) {
    let base = booksCol;
    if (categoryCode) base = base.where('category_code', '==', categoryCode);
    if (status) base = base.where('status', '==', status);
    base = base.orderBy(firestoreStatic.FieldPath.documentId(), 'desc').limit(500);
    const snap = await base.get();
    const results = snap.docs
      .map((d) => d.data())
      .filter((b) => {
        const hay = `${b.book_name || ''} ${b.author_name || ''} ${b.publication_name || ''}`.toLowerCase();
        return hay.includes(needle);
      });
    return { results, nextCursor: null, hasMore: false, cappedSearch: snap.docs.length === 500 };
  }

  // No text query — plain browse/filter, fully paginated server-side so
  // opening the screen only costs `pageSize` reads, not the whole library.
  let base = booksCol;
  if (categoryCode) base = base.where('category_code', '==', categoryCode);
  if (status) base = base.where('status', '==', status);
  base = base.orderBy(firestoreStatic.FieldPath.documentId(), 'desc');
  if (cursor) base = base.startAfter(cursor);
  base = base.limit(pageSize);

  const snap = await base.get();
  const results = snap.docs.map((d) => d.data());
  const nextCursor = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
  const hasMore = snap.docs.length === pageSize;
  return { results, nextCursor, hasMore, cappedSearch: false };
}

export async function findBookByBarcodeOrId(value) {
  // Bounded lookups instead of scanning the entire collection — this
  // function runs on nearly every issue/return/delete action, so keeping
  // it cheap matters far more than any other single change in this file.
  const byBarcode = await booksCol.where('barcode', '==', value).limit(1).get();
  if (!byBarcode.empty) return byBarcode.docs[0].data();

  const numeric = Number(value);
  if (!isNaN(numeric)) {
    const byId = await booksCol.doc(String(numeric)).get();
    if (byId.exists) return byId.data();
  }
  return null;
}

export async function getStockStats() {
  // Reads the running counters doc instead of the whole books collection —
  // 1 read total, regardless of how many thousands of books you have.
  const snap = await countersRef.get();
  const data = snap.exists ? snap.data() : { nextBookId: 1, categoryCounters: {}, issuedCount: 0 };
  const total = (data.nextBookId || 1) - 1;
  const issued = data.issuedCount || 0;
  const byCategory = Object.entries(data.categoryCounters || {}).map(([category_code, c]) => ({
    category_code,
    c,
  }));
  return { total, issued, available: total - issued, byCategory };
}

// ---------- Members ----------

export async function addMember({ memberId, name, phone, address }) {
  await membersCol.doc(memberId).set({
    member_id: memberId,
    name: name || null,
    phone: phone || null,
    address: address || null,
    created_at: new Date().toISOString(),
  });
}

export async function upsertMember(memberId, name = '', phone = '', address = '') {
  const existing = await membersCol.doc(memberId).get();
  await membersCol.doc(memberId).set(
    {
      member_id: memberId,
      name,
      phone,
      address,
      created_at: existing.exists ? existing.data().created_at : new Date().toISOString(),
    },
    { merge: true }
  );
}

export async function getMember(memberId) {
  const snap = await membersCol.doc(memberId).get();
  return snap.exists ? snap.data() : null;
}

export async function getAllMembers() {
  const snap = await membersCol.get();
  return snap.docs.map((d) => d.data());
}

export async function searchMembers(q) {
  const all = await getAllMembers();
  if (!q) return all;
  const needle = q.toLowerCase();
  return all.filter((m) => {
    const hay = `${m.member_id || ''} ${m.name || ''} ${m.phone || ''}`.toLowerCase();
    return hay.includes(needle);
  });
}

export async function bulkImportMembers(rows) {
  let inserted = 0;
  let failed = [];
  for (const row of rows) {
    try {
      if (!row.memberId) throw new Error('Missing Member ID');
      await upsertMember(row.memberId, row.name || '', row.phone || '', row.address || '');
      inserted += 1;
    } catch (e) {
      failed.push({ row, error: e.message });
    }
  }
  return { inserted, failed };
}

// ---------- Issue / Return ----------

export async function issueBook({ memberId, bookId }) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found');
  if (book.status === 'issued') throw new Error('This book is already issued');

  const issueDate = new Date();
  const dueDate = new Date();
  dueDate.setDate(issueDate.getDate() + 15);
  const issueDateStr = issueDate.toISOString().split('T')[0];
  const dueDateStr = dueDate.toISOString().split('T')[0];

  await issuesCol.add({
    member_id: memberId,
    book_id: book.book_id,
    issue_date: issueDateStr,
    due_date: dueDateStr,
    return_date: null,
    status: 'issued',
  });
  await booksCol.doc(String(book.book_id)).set({ status: 'issued' }, { merge: true });
  await countersRef.set(
    { issuedCount: firestoreStatic.FieldValue.increment(1) },
    { merge: true }
  );

  return { issueDate: issueDateStr, dueDate: dueDateStr, book };
}

export async function returnBook({ bookId }) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found');

  const returnDateStr = new Date().toISOString().split('T')[0];

  // Only scan issues for THIS book that are still open — bounded to a
  // handful of records instead of the entire issues history.
  const snap = await issuesCol
    .where('book_id', '==', book.book_id)
    .where('status', '==', 'issued')
    .limit(1)
    .get();
  if (!snap.empty) {
    await issuesCol.doc(snap.docs[0].id).set(
      { return_date: returnDateStr, status: 'returned' },
      { merge: true }
    );
  }
  await booksCol.doc(String(book.book_id)).set({ status: 'available' }, { merge: true });
  await countersRef.set(
    { issuedCount: firestoreStatic.FieldValue.increment(-1) },
    { merge: true }
  );

  return { returnDate: returnDateStr, book };
}

// Deletes a single book. Blocks deletion if it's currently issued (return it
// first) so the issue history never points at a book that no longer exists.
export async function deleteBook(bookId) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found');
  if (book.status === 'issued') {
    throw new Error('This book is currently issued. Return it before deleting.');
  }
  await booksCol.doc(String(book.book_id)).delete();
  return book;
}

// Deletes a single member. Blocks deletion if they currently have a book
// issued to them, so issue history stays consistent.
export async function deleteMember(memberId) {
  const activeSnap = await issuesCol.where('member_id', '==', memberId).where('status', '==', 'issued').get();
  if (!activeSnap.empty) {
    throw new Error('This member currently has a book issued. Return it before deleting.');
  }
  await membersCol.doc(memberId).delete();
}

export async function getActiveIssues() {
  // Only the currently-issued records, not the entire issue history.
  const issuesSnap = await issuesCol.where('status', '==', 'issued').get();
  const activeIssues = issuesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Fetch only the specific books referenced by these issues (bounded to
  // however many are actually checked out, not the whole collection).
  const bookSnaps = await Promise.all(
    activeIssues.map((i) => booksCol.doc(String(i.book_id)).get())
  );
  const bookMap = {};
  bookSnaps.forEach((snap) => {
    if (snap.exists) bookMap[snap.data().book_id] = snap.data();
  });

  const rows = activeIssues
    .map((i) => ({
      ...i,
      book_name: bookMap[i.book_id]?.book_name || '(deleted book)',
      author_name: bookMap[i.book_id]?.author_name || '',
    }))
    .sort((a, b) => (a.due_date > b.due_date ? 1 : -1));
  return rows;
}

export async function getAllIssuesFull() {
  const snap = await issuesCol.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---------- Backup / Restore ----------

export async function getBackupData() {
  const [books, members, issues] = await Promise.all([
    getAllBooks(),
    getAllMembers(),
    getAllIssuesFull(),
  ]);
  return { books, members, issues };
}

export async function clearAllData() {
  for (const col of [booksCol, membersCol, issuesCol]) {
    const snap = await col.get();
    const batch = firestore.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    if (snap.docs.length) await batch.commit();
  }
  await countersRef.set({ nextBookId: 1, categoryCounters: {}, issuedCount: 0 });
  return true;
}

export async function restoreFullBackup({ books = [], members = [], issues = [] }) {
  await clearAllData();
  let maxBookId = 0;
  let issuedCount = 0;
  const categoryCounters = {};

  for (const b of books) {
    await booksCol.doc(String(b.book_id)).set({
      book_id: b.book_id,
      category_code: b.category_code,
      category_no: b.category_no,
      category_type: b.category_type || null,
      book_name: b.book_name,
      author_name: b.author_name || null,
      publication_name: b.publication_name || null,
      cost: b.cost || null,
      barcode: b.barcode || null,
      status: b.status || 'available',
      created_at: b.created_at || new Date().toISOString(),
    });
    if (b.book_id > maxBookId) maxBookId = b.book_id;
    if (b.category_no > (categoryCounters[b.category_code] || 0)) {
      categoryCounters[b.category_code] = b.category_no;
    }
    if (b.status === 'issued') issuedCount += 1;
  }

  for (const m of members) {
    await membersCol.doc(m.member_id).set({
      member_id: m.member_id,
      name: m.name || null,
      phone: m.phone || null,
      address: m.address || null,
      created_at: m.created_at || new Date().toISOString(),
    });
  }

  for (const i of issues) {
    await issuesCol.add({
      member_id: i.member_id,
      book_id: i.book_id,
      issue_date: i.issue_date,
      due_date: i.due_date,
      return_date: i.return_date || null,
      status: i.status || 'issued',
    });
  }

  await countersRef.set({ nextBookId: maxBookId + 1, categoryCounters, issuedCount });

  return { books: books.length, members: members.length, issues: issues.length };
}

export default firestore;
