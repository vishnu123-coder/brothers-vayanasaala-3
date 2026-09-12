// database/db.js
// Shared cloud database using the NATIVE React Native Firebase SDK — this
// has real offline persistence built into the phone: data typed in while
// fully offline (even from a cold app start) is saved locally immediately
// and synced automatically once the connection returns.
//
// Every function here keeps the EXACT same name/signature as before, so
// none of the screens need to change.
import { db as firestore } from './firebaseConfig';

export const CATEGORIES = [
  { code: 'N', label: 'Novel', color: '#2563EB' },
  { code: 'S', label: 'Story', color: '#0D9488' },
  { code: 'P', label: 'Poem', color: '#9333EA' },
  { code: 'R', label: 'Reference', color: '#B45309' },
  { code: 'OT', label: 'Others', color: '#6B7280' },
  { code: 'CL', label: "Children's literature", color: '#DB2777' },
  { code: 'B', label: 'Biography/Autobiography', color: '#065F46' },
  { code: 'E', label: 'Essay / Memoir', color: '#7C3AED' },
  { code: 'SD', label: 'Story-Drama', color: '#EA580C' },
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
    await countersRef.set({ nextBookId: 1, categoryCounters: {} });
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

export async function searchBooks({ query: q, categoryCode, status }) {
  const all = await getAllBooks();
  const needle = (q || '').toLowerCase();
  return all.filter((b) => {
    if (categoryCode && b.category_code !== categoryCode) return false;
    if (status && b.status !== status) return false;
    if (needle) {
      const hay = `${b.book_name || ''} ${b.author_name || ''} ${b.publication_name || ''}`.toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

export async function findBookByBarcodeOrId(value) {
  const all = await getAllBooks();
  const numeric = Number(value);
  return all.find((b) => b.barcode === value || b.book_id === numeric) || null;
}

export async function getStockStats() {
  const all = await getAllBooks();
  const byCategoryMap = {};
  let issued = 0;
  for (const b of all) {
    byCategoryMap[b.category_code] = (byCategoryMap[b.category_code] || 0) + 1;
    if (b.status === 'issued') issued += 1;
  }
  const byCategory = Object.entries(byCategoryMap).map(([category_code, c]) => ({ category_code, c }));
  return { total: all.length, issued, available: all.length - issued, byCategory };
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

  return { issueDate: issueDateStr, dueDate: dueDateStr, book };
}

export async function returnBook({ bookId }) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found');

  const returnDateStr = new Date().toISOString().split('T')[0];

  const snap = await issuesCol.get();
  const activeIssue = snap.docs.find(
    (d) => d.data().book_id === book.book_id && d.data().status === 'issued'
  );
  if (activeIssue) {
    await issuesCol.doc(activeIssue.id).set(
      { return_date: returnDateStr, status: 'returned' },
      { merge: true }
    );
  }
  await booksCol.doc(String(book.book_id)).set({ status: 'available' }, { merge: true });

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
  const [issuesSnap, books] = await Promise.all([issuesCol.get(), getAllBooks()]);
  const bookMap = Object.fromEntries(books.map((b) => [b.book_id, b]));
  const rows = issuesSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((i) => i.status === 'issued')
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
  await countersRef.set({ nextBookId: 1, categoryCounters: {} });
  return true;
}

export async function restoreFullBackup({ books = [], members = [], issues = [] }) {
  await clearAllData();
  let maxBookId = 0;
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

  await countersRef.set({ nextBookId: maxBookId + 1, categoryCounters });

  return { books: books.length, members: members.length, issues: issues.length };
}

export default firestore;
