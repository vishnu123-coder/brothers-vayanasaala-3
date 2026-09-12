[9/12/2026 9:24 AM] Vp: // database/db.js
// Brothers Vayanasala Library Database
//
// Local database: SQLite
// Online database: Firebase Firestore
//
// SQLite remains the local/offline database.
// Firestore is used to synchronize books, members and issues
// between multiple devices.

import * as SQLite from 'expo-sqlite/legacy';

import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';

import { db as firestoreDb } from '../firebase';

const db = SQLite.openDatabase('libratrack.db');

// ============================================================
// CONSTANTS
// ============================================================

export const CATEGORIES = [
  { code: 'N', label: 'Novel' },
  { code: 'S', label: 'Story' },
  { code: 'P', label: 'Poem' },
  { code: 'R', label: 'Reference' },
  { code: 'OT', label: 'Others' },
  { code: 'CL', label: "Children's literature" },
  { code: 'B', label: 'Biography/Autobiography' },
  { code: 'E', label: 'Essay / Memoir' },
  { code: 'SD', label: 'Story-Drama' },
];

export const LANGUAGES = [
  'English',
  'Hindi',
  'Malayalam',
  'Tamil',
  'Kannada',
  'Telugu',
  'Other',
];

// ============================================================
// SQLITE HELPER
// ============================================================

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        sql,
        params,
        (_, result) => resolve(result),
        (_, error) => {
          reject(error);
          return false;
        }
      );
    });
  });
}

// ============================================================
// FIREBASE HELPERS
// ============================================================

// Firebase errors should NOT stop the local library from working.
// Local SQLite remains the primary offline database.

async function safeCloudOperation(operation) {
  try {
    await operation();
    return true;
  } catch (error) {
    console.log('Firebase sync skipped:', error?.message || error);
    return false;
  }
}

// ============================================================
// INITIALIZE LOCAL DATABASE
// ============================================================

export function initDatabase() {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER UNIQUE,
            category_code TEXT NOT NULL,
            category_no INTEGER NOT NULL,
            category_label TEXT,
            category_type TEXT,
            book_name TEXT NOT NULL,
            author_name TEXT,
            publication_name TEXT,
            cost REAL,
            barcode TEXT,
            status TEXT DEFAULT 'available',
            created_at TEXT DEFAULT (datetime('now'))
          );
        );

        tx.executeSql(
          CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id TEXT UNIQUE NOT NULL,
            name TEXT,
            phone TEXT,
            address TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          );
        );

        tx.executeSql(
          CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id TEXT NOT NULL,
            book_id INTEGER NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT,
            status TEXT DEFAULT 'issued'
          );
        );

        tx.executeSql(
          CREATE INDEX IF NOT EXISTS idx_books_name
          ON books(book_name);
        );

        tx.executeSql(
          CREATE INDEX IF NOT EXISTS idx_books_author
          ON books(author_name);
        );

        tx.executeSql(
          CREATE INDEX IF NOT EXISTS idx_books_barcode
          ON books(barcode);
        );
[9/12/2026 9:24 AM] Vp: // Existing installations may not have category_label.
        tx.executeSql(
          ALTER TABLE books ADD COLUMN category_label TEXT;,
          [],
          () => {},
          () => false
        );

        // Existing installations may not have member address.
        tx.executeSql(
          ALTER TABLE members ADD COLUMN address TEXT;,
          [],
          () => {},
          () => false
        );
      },
      (error) => reject(error),
      () => resolve(true)
    );
  });
}

// ============================================================
// BOOK NUMBER HELPERS
// ============================================================

export async function getNextBookId() {
  const result = await runSql(
    SELECT MAX(book_id) AS maxId FROM books;
  );

  const maxId = result.rows.item(0).maxId;

  return (maxId || 0) + 1;
}

export async function getNextCategoryNo(categoryCode) {
  const result = await runSql(
    SELECT MAX(category_no) AS maxNo
     FROM books
     WHERE category_code = ?;,
    [categoryCode]
  );

  const maxNo = result.rows.item(0).maxNo;

  return (maxNo || 0) + 1;
}

// ============================================================
// CLOUD BOOK SYNC
// ============================================================

async function uploadBookToCloud(book) {
  if (!book?.book_id) return;

  await safeCloudOperation(async () => {
    await setDoc(
      doc(firestoreDb, 'books', String(book.book_id)),
      {
        book_id: book.book_id,
        category_code: book.category_code || '',
        category_no: book.category_no || 0,
        category_label: book.category_label || '',
        category_type: book.category_type || '',
        book_name: book.book_name || '',
        author_name: book.author_name || '',
        publication_name: book.publication_name || '',
        cost: book.cost ?? null,
        barcode: book.barcode || '',
        status: book.status || 'available',
        created_at: book.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  });
}

// ============================================================
// BOOKS
// ============================================================

export async function addBook({
  categoryCode,
  categoryNo,
  categoryLabel,
  categoryType,
  bookName,
  authorName,
  publicationName,
  cost,
  barcode,
}) {
  const bookId = await getNextBookId();

  const finalCategoryNo =
    categoryNo || (await getNextCategoryNo(categoryCode));

  await runSql(
    INSERT INTO books
    (
      book_id,
      category_code,
      category_no,
      category_label,
      category_type,
      book_name,
      author_name,
      publication_name,
      cost,
      barcode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);,
    [
      bookId,
      categoryCode || '',
      finalCategoryNo,
      categoryLabel || '',
      categoryType || '',
      bookName || '',
      authorName || null,
      publicationName || null,
      cost ?? null,
      barcode || null,
    ]
  );

  const book = await findBookByBarcodeOrId(bookId);

  await uploadBookToCloud(book);

  return {
    bookId,
    categoryNo: finalCategoryNo,
  };
}

// ============================================================
// BULK BOOK IMPORT
// ============================================================

export async function bulkAddBooks(rows) {
  let inserted = 0;
  const failed = [];

  for (const row of rows) {
    try {
      await addBook(row);
      inserted++;
    } catch (error) {
      failed.push({
        row,
        error: error?.message || String(error),
      });
    }
  }

  return {
    inserted,
    failed,
  };
}

// ============================================================
// EXPLICIT BOOK INSERT / UPDATE
// ============================================================
[9/12/2026 9:24 AM] Vp: export async function addBookExplicit({
  bookId,
  categoryCode,
  categoryNo,
  categoryLabel,
  categoryType,
  bookName,
  authorName,
  publicationName,
  cost,
  barcode,
  status,
}) {
  const existing = await findBookByBarcodeOrId(bookId);

  await runSql(
    INSERT OR REPLACE INTO books
    (
      book_id,
      category_code,
      category_no,
      category_label,
      category_type,
      book_name,
      author_name,
      publication_name,
      cost,
      barcode,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);,
    [
      bookId,
      categoryCode || '',
      categoryNo || 0,
      categoryLabel || '',
      categoryType || '',
      bookName || '',
      authorName || null,
      publicationName || null,
      cost ?? null,
      barcode || null,
      status  existing?.status  'available',
    ]
  );

  const book = await findBookByBarcodeOrId(bookId);

  await uploadBookToCloud(book);
}

// ============================================================
// SMART LIBRARY IMPORT
// ============================================================

export async function bulkImportLibraryBooks(rows) {
  let inserted = 0;
  const failed = [];

  for (const row of rows) {
    try {
      if (row.bookId && row.categoryNo) {
        await addBookExplicit(row);
      } else {
        await addBook(row);
      }

      inserted++;
    } catch (error) {
      failed.push({
        row,
        error: error?.message || String(error),
      });
    }
  }

  return {
    inserted,
    failed,
  };
}

// ============================================================
// GET BOOKS
// ============================================================

export async function getAllBooks() {
  const result = await runSql(
    SELECT * FROM books ORDER BY book_id DESC;
  );

  const rows = [];

  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
}

// ============================================================
// SEARCH BOOKS
// ============================================================

export async function searchBooks({
  query,
  categoryCode,
  categoryLabel,
  status,
}) {
  let sql = SELECT * FROM books WHERE 1=1;
  const params = [];

  if (categoryCode) {
    sql +=  AND category_code = ?;
    params.push(categoryCode);
  }

  if (categoryLabel) {
    sql +=  AND category_label = ?;
    params.push(categoryLabel);
  }

  if (status) {
    sql +=  AND status = ?;
    params.push(status);
  }

  if (query) {
    sql += 
      AND (
        book_name LIKE ?
        OR author_name LIKE ?
        OR publication_name LIKE ?
        OR barcode LIKE ?
        OR CAST(book_id AS TEXT) LIKE ?
        OR category_label LIKE ?
      )
    ;

    const like = %${query}%;

    params.push(
      like,
      like,
      like,
      like,
      like,
      like
    );
  }

  sql +=  ORDER BY book_id DESC;;

  const result = await runSql(sql, params);

  const rows = [];

  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
}

// ============================================================
// FIND BOOK
// ============================================================

export async function findBookByBarcodeOrId(value) {
  const numericValue = isNaN(Number(value))
    ? -1
    : Number(value);

  const result = await runSql(
    SELECT *
     FROM books
     WHERE barcode = ?
     OR book_id = ?
     LIMIT 1;,
    [String(value), numericValue]
  );

  return result.rows.length > 0
    ? result.rows.item(0)
    : null;
}

// ============================================================
// CATEGORY LIST
// ============================================================

export async function getCategoryLabels() {
  const result = await runSql(
    SELECT DISTINCT category_label
    FROM books
    WHERE category_label IS NOT NULL
      AND category_label != ''
    ORDER BY category_label ASC;
  );

  const rows = [];
[9/12/2026 9:24 AM] Vp: for (let i = 0; i < result.rows.length; i++) {
    const value = result.rows.item(i).category_label;

    if (value) {
      rows.push(value);
    }
  }

  return rows;
}

// ============================================================
// STOCK STATISTICS
// ============================================================

export async function getStockStats() {
  const total = await runSql(
    SELECT COUNT(*) AS c FROM books;
  );

  const issued = await runSql(
    SELECT COUNT(*) AS c
     FROM books
     WHERE status = 'issued';
  );

  const available = await runSql(
    SELECT COUNT(*) AS c
     FROM books
     WHERE status = 'available';
  );

  const byCategory = await runSql(
    SELECT
      category_code,
      category_label,
      COUNT(*) AS c
    FROM books
    GROUP BY category_code, category_label;
  );

  const categoryRows = [];

  for (let i = 0; i < byCategory.rows.length; i++) {
    categoryRows.push(byCategory.rows.item(i));
  }

  return {
    total: total.rows.item(0).c,
    issued: issued.rows.item(0).c,
    available: available.rows.item(0).c,
    byCategory: categoryRows,
  };
}

// ============================================================
// MEMBERS
// ============================================================

async function uploadMemberToCloud(member) {
  if (!member?.member_id) return;

  await safeCloudOperation(async () => {
    // Member ID is the Firestore document ID.
    // This automatically prevents duplicate member IDs.
    await setDoc(
      doc(firestoreDb, 'members', String(member.member_id)),
      {
        member_id: String(member.member_id),
        name: member.name || '',
        phone: member.phone || '',
        address: member.address || '',
        created_at: member.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  });
}

export async function addMember({
  memberId,
  name,
  phone,
  address,
}) {
  await runSql(
    INSERT INTO members
    (member_id, name, phone, address)
    VALUES (?, ?, ?, ?);,
    [
      memberId,
      name || null,
      phone || null,
      address || null,
    ]
  );

  const member = await getMember(memberId);

  await uploadMemberToCloud(member);
}

export async function upsertMember(
  memberId,
  name = '',
  phone = '',
  address = ''
) {
  await runSql(
    INSERT INTO members
    (member_id, name, phone, address)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(member_id)
    DO UPDATE SET
      name = excluded.name,
      phone = excluded.phone,
      address = excluded.address;,
    [
      memberId,
      name,
      phone,
      address,
    ]
  );

  const member = await getMember(memberId);

  await uploadMemberToCloud(member);
}

export async function getMember(memberId) {
  const result = await runSql(
    SELECT *
     FROM members
     WHERE member_id = ?;,
    [memberId]
  );

  return result.rows.length > 0
    ? result.rows.item(0)
    : null;
}

export async function searchMembers(query) {
  let sql = SELECT * FROM members;
  const params = [];

  if (query) {
    sql += 
      WHERE member_id LIKE ?
      OR name LIKE ?
      OR phone LIKE ?
      OR address LIKE ?
    ;

    const like = %${query}%;

    params.push(
      like,
      like,
      like,
      like
    );
  }

  sql +=  ORDER BY id DESC;;

  const result = await runSql(sql, params);

  const rows = [];

  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
}

export async function getAllMembers() {
  const result = await runSql(
    SELECT * FROM members ORDER BY id ASC;
  );

  const rows = [];

  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
}

export async function bulkImportMembers(rows) {
  let inserted = 0;
  const failed = [];

  for (const row of rows) {
    try {
      if (!row.memberId) {
        throw new Error('Missing Member ID');
      }
[9/12/2026 9:24 AM] Vp: await upsertMember(
        row.memberId,
        row.name || '',
        row.phone || '',
        row.address || ''
      );

      inserted++;
    } catch (error) {
      failed.push({
        row,
        error: error?.message || String(error),
      });
    }
  }

  return {
    inserted,
    failed,
  };
}

// ============================================================
// ISSUE / RETURN
// ============================================================

async function uploadIssueToCloud(issue) {
  if (!issue?.id) return;

  await safeCloudOperation(async () => {
    await setDoc(
      doc(firestoreDb, 'issues', String(issue.id)),
      {
        id: issue.id,
        member_id: String(issue.member_id),
        book_id: issue.book_id,
        issue_date: issue.issue_date,
        due_date: issue.due_date,
        return_date: issue.return_date || null,
        status: issue.status || 'issued',
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  });
}

export async function issueBook({
  memberId,
  bookId,
}) {
  const member = await getMember(memberId);

  if (!member) {
    throw new Error('Member not found. Please register the member first.');
  }

  const book = await findBookByBarcodeOrId(bookId);

  if (!book) {
    throw new Error('Book not found');
  }

  if (book.status === 'issued') {
    throw new Error('This book is already issued');
  }

  const issueDate = new Date();

  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 15);

  const issueDateStr =
    issueDate.toISOString().split('T')[0];

  const dueDateStr =
    dueDate.toISOString().split('T')[0];

  await runSql(
    INSERT INTO issues
    (member_id, book_id, issue_date, due_date, status)
    VALUES (?, ?, ?, ?, 'issued');,
    [
      memberId,
      book.book_id,
      issueDateStr,
      dueDateStr,
    ]
  );

  await runSql(
    UPDATE books
     SET status = 'issued'
     WHERE book_id = ?;,
    [book.book_id]
  );

  const issues = await runSql(
    SELECT *
     FROM issues
     WHERE book_id = ?
       AND status = 'issued'
     ORDER BY id DESC
     LIMIT 1;,
    [book.book_id]
  );

  if (issues.rows.length > 0) {
    await uploadIssueToCloud(
      issues.rows.item(0)
    );
  }

  const updatedBook =
    await findBookByBarcodeOrId(book.book_id);

  await uploadBookToCloud(updatedBook);

  return {
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    book: updatedBook,
  };
}

export async function returnBook({
  bookId,
}) {
  const book = await findBookByBarcodeOrId(bookId);

  if (!book) {
    throw new Error('Book not found');
  }

  const activeIssueResult = await runSql(
    SELECT *
     FROM issues
     WHERE book_id = ?
       AND status = 'issued'
     ORDER BY id DESC
     LIMIT 1;,
    [book.book_id]
  );

  if (activeIssueResult.rows.length === 0) {
    throw new Error('This book is not currently issued');
  }

  const activeIssue =
    activeIssueResult.rows.item(0);

  const returnDateStr =
    new Date().toISOString().split('T')[0];

  await runSql(
    UPDATE issues
     SET return_date = ?,
         status = 'returned'
     WHERE id = ?;,
    [
      returnDateStr,
      activeIssue.id,
    ]
  );

  await runSql(
    UPDATE books
     SET status = 'available'
     WHERE book_id = ?;,
    [book.book_id]
  );

  const returnedIssueResult =
    await runSql(
      SELECT *
       FROM issues
       WHERE id = ?;,
      [activeIssue.id]
    );

  if (returnedIssueResult.rows.length > 0) {
    await uploadIssueToCloud(
      returnedIssueResult.rows.item(0)
    );
  }

  const updatedBook =
    await findBookByBarcodeOrId(book.book_id);

  await uploadBookToCloud(updatedBook);

  return {
    returnDate: returnDateStr,
    book: updatedBook,
  };
}
[9/12/2026 9:24 AM] Vp: export async function getActiveIssues() {
  const result = await runSql(
    SELECT
      issues.*,
      books.book_name,
      books.author_name
    FROM issues
    JOIN books
      ON books.book_id = issues.book_id
    WHERE issues.status = 'issued'
    ORDER BY issues.due_date ASC;
  );

  const rows = [];
  [9/12/2026 9:27 AM] Vp: for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
}

// ============================================================
// BACKUP
// ============================================================

export async function getAllIssuesFull() {
  const result = await runSql(
    SELECT * FROM issues ORDER BY id ASC;
  );

  const rows = [];

  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
}

export async function getBackupData() {
  const [
    books,
    members,
    issues,
  ] = await Promise.all([
    getAllBooks(),
    getAllMembers(),
    getAllIssuesFull(),
  ]);

  return {
    books,
    members,
    issues,
  };
}

// ============================================================
// LOCAL RESTORE
// ============================================================

export function clearAllData() {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(DELETE FROM issues;);
        tx.executeSql(DELETE FROM books;);
        tx.executeSql(DELETE FROM members;);
      },
      (error) => reject(error),
      () => resolve(true)
    );
  });
}

export async function restoreFullBackup({
  books = [],
  members = [],
  issues = [],
}) {
  await clearAllData();

  for (const b of books) {
    await runSql(
      INSERT INTO books
      (
        book_id,
        category_code,
        category_no,
        category_label,
        category_type,
        book_name,
        author_name,
        publication_name,
        cost,
        barcode,
        status,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')));,
      [
        b.book_id,
        b.category_code || '',
        b.category_no || 0,
        b.category_label || '',
        b.category_type || null,
        b.book_name || '',
        b.author_name || null,
        b.publication_name || null,
        b.cost ?? null,
        b.barcode || null,
        b.status || 'available',
        b.created_at || null,
      ]
    );
  }

  for (const m of members) {
    await runSql(
      INSERT INTO members
      (
        member_id,
        name,
        phone,
        address,
        created_at
      )
      VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')));,
      [
        m.member_id,
        m.name || null,
        m.phone || null,
        m.address || null,
        m.created_at || null,
      ]
    );
  }

  for (const i of issues) {
    await runSql(
      INSERT INTO issues
      (
        member_id,
        book_id,
        issue_date,
        due_date,
        return_date,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?);,
      [
        i.member_id,
        i.book_id,
        i.issue_date,
        i.due_date,
        i.return_date || null,
        i.status || 'issued',
      ]
    );
  }

  return {
    books: books.length,
    members: members.length,
    issues: issues.length,
  };
}

// ============================================================
// FIRESTORE → LOCAL
// ============================================================

export async function syncCloudToLocal() {
  const result = {
    books: 0,
    members: 0,
    issues: 0,
  };

  // ---------------- BOOKS ----------------

  await safeCloudOperation(async () => {
    const snapshot = await getDocs(
      collection(firestoreDb, 'books')
    );

    for (const document of snapshot.docs) {
      const b = document.data();

      if (!b.book_id || !b.book_name) {
        continue;
      }

      await runSql(
        `INSERT OR REPLACE INTO books
        (
          book_id,
          category_code,
          category_no,
          category_label,
          category_type,
          book_name,
          author_name,
[9/12/2026 9:27 AM] Vp: publication_name,
          cost,
          barcode,
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);,
        [
          b.book_id,
          b.category_code || '',
          b.category_no || 0,
          b.category_label || '',
          b.category_type || '',
          b.book_name || '',
          b.author_name || '',
          b.publication_name || '',
          b.cost ?? null,
          b.barcode || '',
          b.status || 'available',
          b.created_at || new Date().toISOString(),
        ]
      );

      result.books++;
    }
  });

  // ---------------- MEMBERS ----------------

  await safeCloudOperation(async () => {
    const snapshot = await getDocs(
      collection(firestoreDb, 'members')
    );

    for (const document of snapshot.docs) {
      const m = document.data();

      if (!m.member_id) {
        continue;
      }

      await runSql(
        INSERT OR REPLACE INTO members
        (
          member_id,
          name,
          phone,
          address,
          created_at
        )
        VALUES (?, ?, ?, ?, ?);,
        [
          String(m.member_id),
          m.name || '',
          m.phone || '',
          m.address || '',
          m.created_at || new Date().toISOString(),
        ]
      );

      result.members++;
    }
  });

  // ---------------- ISSUES ----------------

  await safeCloudOperation(async () => {
    const snapshot = await getDocs(
      collection(firestoreDb, 'issues')
    );

    for (const document of snapshot.docs) {
      const i = document.data();

      if (!i.id) {
        continue;
      }

      await runSql(
        INSERT OR REPLACE INTO issues
        (
          id,
          member_id,
          book_id,
          issue_date,
          due_date,
          return_date,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          i.id,
          i.member_id,
          i.book_id,
          i.issue_date,
          i.due_date,
          i.return_date || null,
          i.status || 'issued',
        ]
      );

      result.issues++;
    }
  });

  return result;
}

// ============================================================
// LOCAL → FIRESTORE
// ============================================================

export async function syncLocalToCloud() {
  const books = await getAllBooks();
  const members = await getAllMembers();
  const issues = await getAllIssuesFull();

  const result = {
    books: 0,
    members: 0,
    issues: 0,
  };

  await safeCloudOperation(async () => {

    // ---------------- BOOKS ----------------

    let batch = writeBatch(firestoreDb);
    let count = 0;

    for (const book of books) {
      const ref = doc(
        firestoreDb,
        'books',
        String(book.book_id)
      );

      batch.set(
        ref,
        {
          book_id: book.book_id,
          category_code: book.category_code || '',
          category_no: book.category_no || 0,
          category_label: book.category_label || '',
          category_type: book.category_type || '',
          book_name: book.book_name || '',
          author_name: book.author_name || '',
          publication_name: book.publication_name || '',
          cost: book.cost ?? null,
          barcode: book.barcode || '',
          status: book.status || 'available',
          created_at:
            book.created_at ||
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        },
        { merge: true }
      );

      count++;
      result.books++;

      if (count === 450) {
        await batch.commit();
        batch = writeBatch(firestoreDb);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    // ---------------- MEMBERS ----------------

    batch = writeBatch(firestoreDb);
    count = 0;

    for (const member of members) {
      const ref = doc(
        firestoreDb,
        'members',
        String(member.member_id)
      );
[9/12/2026 9:27 AM] Vp: batch.set(
        ref,
        {
          member_id: String(member.member_id),
          name: member.name || '',
          phone: member.phone || '',
          address: member.address || '',
          created_at:
            member.created_at ||
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        },
        { merge: true }
      );

      count++;
      result.members++;

      if (count === 450) {
        await batch.commit();
        batch = writeBatch(firestoreDb);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }

    // ---------------- ISSUES ----------------

    batch = writeBatch(firestoreDb);
    count = 0;

    for (const issue of issues) {
      const ref = doc(
        firestoreDb,
        'issues',
        String(issue.id)
      );

      batch.set(
        ref,
        {
          id: issue.id,
          member_id: String(issue.member_id),
          book_id: issue.book_id,
          issue_date: issue.issue_date,
          due_date: issue.due_date,
          return_date:
            issue.return_date || null,
          status:
            issue.status || 'issued',
          updated_at:
            new Date().toISOString(),
        },
        { merge: true }
      );

      count++;
      result.issues++;

      if (count === 450) {
        await batch.commit();
        batch = writeBatch(firestoreDb);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  });

  return result;
}

// ============================================================
// DEFAULT EXPORT
// ============================================================

export default db;
