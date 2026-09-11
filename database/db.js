// database/db.js
// SQLite database layer for LibraTrack.
// Uses the legacy expo-sqlite transaction API for broad compatibility.
import * as SQLite from 'expo-sqlite/legacy';

const db = SQLite.openDatabase('libratrack.db');

// Category code map — used to build the human readable Category Number (e.g. N-20)
export const CATEGORIES = [
  { code: 'N', label: 'Novel' },
  { code: 'S', label: 'Story' },
  { code: 'P', label: 'Poem' },
  { code: 'R', label: 'Reference' },
  { code: 'OT', label: 'Others' },
  { code: 'CL', label: "Children's literature" },
  { code: 'B', label: 'Biography/Autobiography' },
];

// Extend this list freely — it drives the "Category Type" (language) dropdown.
export const LANGUAGES = [
  'English',
  'Hindi',
  'Malayalam',
  'Tamil',
  'Kannada',
  'Telugu',
  'Other',
];

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

export function initDatabase() {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS books (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER UNIQUE,
            category_code TEXT NOT NULL,
            category_no INTEGER NOT NULL,
            category_type TEXT,
            book_name TEXT NOT NULL,
            author_name TEXT,
            publication_name TEXT,
            cost REAL,
            barcode TEXT,
            status TEXT DEFAULT 'available',
            created_at TEXT DEFAULT (datetime('now'))
          );
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id TEXT UNIQUE NOT NULL,
            name TEXT,
            phone TEXT,
            created_at TEXT DEFAULT (datetime('now'))
          );
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id TEXT NOT NULL,
            book_id INTEGER NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT,
            status TEXT DEFAULT 'issued'
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_books_name ON books(book_name);`);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_books_author ON books(author_name);`);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_books_barcode ON books(barcode);`);
      },
      (error) => reject(error),
      () => resolve(true)
    );
  });
}

// ---------- Auto-numbering helpers ----------

// Next overall stock number (Book ID)
export async function getNextBookId() {
  const result = await runSql(
    `SELECT MAX(book_id) as maxId FROM books;`
  );
  const maxId = result.rows.item(0).maxId;
  return (maxId || 0) + 1;
}

// Next number *within* a category, e.g. for 'N' -> N-1, N-2, N-3...
export async function getNextCategoryNo(categoryCode) {
  const result = await runSql(
    `SELECT MAX(category_no) as maxNo FROM books WHERE category_code = ?;`,
    [categoryCode]
  );
  const maxNo = result.rows.item(0).maxNo;
  return (maxNo || 0) + 1;
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
  const bookId = await getNextBookId();
  const categoryNo = await getNextCategoryNo(categoryCode);
  await runSql(
    `INSERT INTO books (book_id, category_code, category_no, category_type, book_name, author_name, publication_name, cost, barcode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [bookId, categoryCode, categoryNo, categoryType, bookName, authorName, publicationName, cost, barcode || null]
  );
  return { bookId, categoryNo };
}

// Bulk import (used by the Excel importer). Expects an array of row objects.
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

export async function getAllBooks() {
  const result = await runSql(`SELECT * FROM books ORDER BY book_id DESC;`);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}

export async function searchBooks({ query, categoryCode }) {
  let sql = `SELECT * FROM books WHERE 1=1`;
  const params = [];
  if (categoryCode) {
    sql += ` AND category_code = ?`;
    params.push(categoryCode);
  }
  if (query) {
    sql += ` AND (book_name LIKE ? OR author_name LIKE ? OR publication_name LIKE ?)`;
    const like = `%${query}%`;
    params.push(like, like, like);
  }
  sql += ` ORDER BY book_id DESC;`;
  const result = await runSql(sql, params);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}

export async function findBookByBarcodeOrId(value) {
  const result = await runSql(
    `SELECT * FROM books WHERE barcode = ? OR book_id = ? LIMIT 1;`,
    [value, isNaN(Number(value)) ? -1 : Number(value)]
  );
  return result.rows.length > 0 ? result.rows.item(0) : null;
}

export async function getStockStats() {
  const total = await runSql(`SELECT COUNT(*) as c FROM books;`);
  const issued = await runSql(`SELECT COUNT(*) as c FROM books WHERE status = 'issued';`);
  const available = await runSql(`SELECT COUNT(*) as c FROM books WHERE status = 'available';`);
  const byCategory = await runSql(
    `SELECT category_code, COUNT(*) as c FROM books GROUP BY category_code;`
  );
  const categoryRows = [];
  for (let i = 0; i < byCategory.rows.length; i++) categoryRows.push(byCategory.rows.item(i));
  return {
    total: total.rows.item(0).c,
    issued: issued.rows.item(0).c,
    available: available.rows.item(0).c,
    byCategory: categoryRows,
  };
}

// ---------- Members ----------

export async function upsertMember(memberId, name = '', phone = '') {
  await runSql(
    `INSERT INTO members (member_id, name, phone) VALUES (?, ?, ?)
     ON CONFLICT(member_id) DO UPDATE SET name = excluded.name, phone = excluded.phone;`,
    [memberId, name, phone]
  );
}

export async function getMember(memberId) {
  const result = await runSql(`SELECT * FROM members WHERE member_id = ?;`, [memberId]);
  return result.rows.length > 0 ? result.rows.item(0) : null;
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

  await runSql(
    `INSERT INTO issues (member_id, book_id, issue_date, due_date, status)
     VALUES (?, ?, ?, ?, 'issued');`,
    [memberId, book.book_id, issueDateStr, dueDateStr]
  );
  await runSql(`UPDATE books SET status = 'issued' WHERE book_id = ?;`, [book.book_id]);

  return { issueDate: issueDateStr, dueDate: dueDateStr, book };
}

export async function returnBook({ bookId }) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found');

  const returnDateStr = new Date().toISOString().split('T')[0];

  await runSql(
    `UPDATE issues SET return_date = ?, status = 'returned'
     WHERE book_id = ? AND status = 'issued';`,
    [returnDateStr, book.book_id]
  );
  await runSql(`UPDATE books SET status = 'available' WHERE book_id = ?;`, [book.book_id]);

  return { returnDate: returnDateStr, book };
}

export async function getActiveIssues() {
  const result = await runSql(`
    SELECT issues.*, books.book_name, books.author_name
    FROM issues
    JOIN books ON books.book_id = issues.book_id
    WHERE issues.status = 'issued'
    ORDER BY issues.due_date ASC;
  `);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}

// ---------- Backup / Restore ----------

// Full dump of every table — used to build the backup .xlsx workbook.
export async function getAllMembers() {
  const result = await runSql(`SELECT * FROM members ORDER BY id ASC;`);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}

export async function getAllIssuesFull() {
  const result = await runSql(`SELECT * FROM issues ORDER BY id ASC;`);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}

export async function getBackupData() {
  const [books, members, issues] = await Promise.all([
    getAllBooks(),
    getAllMembers(),
    getAllIssuesFull(),
  ]);
  return { books, members, issues };
}

// Wipes all library data. Used right before a "replace everything" restore.
export function clearAllData() {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(`DELETE FROM issues;`);
        tx.executeSql(`DELETE FROM books;`);
        tx.executeSql(`DELETE FROM members;`);
      },
      (error) => reject(error),
      () => resolve(true)
    );
  });
}

// Restores a full backup (Books + Members + Issues sheets), preserving the
// original Book IDs / Category Numbers / Issue history exactly as backed up.
// This REPLACES all current data — call after user confirms.
export async function restoreFullBackup({ books = [], members = [], issues = [] }) {
  await clearAllData();

  for (const b of books) {
    await runSql(
      `INSERT INTO books (book_id, category_code, category_no, category_type, book_name, author_name, publication_name, cost, barcode, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')));`,
      [
        b.book_id,
        b.category_code,
        b.category_no,
        b.category_type || null,
        b.book_name,
        b.author_name || null,
        b.publication_name || null,
        b.cost || null,
        b.barcode || null,
        b.status || 'available',
        b.created_at || null,
      ]
    );
  }

  for (const m of members) {
    await runSql(
      `INSERT INTO members (member_id, name, phone, created_at)
       VALUES (?, ?, ?, COALESCE(?, datetime('now')));`,
      [m.member_id, m.name || null, m.phone || null, m.created_at || null]
    );
  }

  for (const i of issues) {
    await runSql(
      `INSERT INTO issues (member_id, book_id, issue_date, due_date, return_date, status)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [i.member_id, i.book_id, i.issue_date, i.due_date, i.return_date || null, i.status || 'issued']
    );
  }

  return { books: books.length, members: members.length, issues: issues.length };
}

export default db;
