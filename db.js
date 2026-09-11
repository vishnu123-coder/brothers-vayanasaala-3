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
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id TEXT UNIQUE NOT NULL,
            name TEXT,
            phone TEXT,
            address TEXT,
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
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_members_name ON members(name);`);
        // V2 category migration: preserve the library's real category identifier
        // (for example SD77) instead of forcing it into the old CODE-N format.
        tx.executeSql(`PRAGMA table_info(books);`, [], (_, result) => {
          let hasCategoryLabel = false;
          for (let i = 0; i < result.rows.length; i++) {
            if (result.rows.item(i).name === 'category_label') hasCategoryLabel = true;
          }
          if (!hasCategoryLabel) {
            tx.executeSql(`ALTER TABLE books ADD COLUMN category_label TEXT;`);
          }
          return false;
        });
        // Existing installations from V1 may not have the address column.
        tx.executeSql(`PRAGMA table_info(members);`, [], (_, result) => {
          let hasAddress = false;
          for (let i = 0; i < result.rows.length; i++) {
            if (result.rows.item(i).name === 'address') hasAddress = true;
          }
          if (!hasAddress) {
            tx.executeSql(`ALTER TABLE members ADD COLUMN address TEXT;`);
          }
          return false;
        });
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
  categoryLabel = '',
  categoryType,
  bookName,
  authorName,
  publicationName,
  cost,
  barcode,
}) {
  const bookId = await getNextBookId();
  const categoryNo = await getNextCategoryNo(categoryCode || 'OT');
  const cleanLabel = String(categoryLabel || '').trim().toUpperCase();
  await runSql(
    `INSERT INTO books (book_id, category_code, category_no, category_label, category_type, book_name, author_name, publication_name, cost, barcode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [bookId, categoryCode || 'OT', categoryNo, cleanLabel || null, categoryType, bookName, authorName, publicationName, cost, barcode || null]
  );
  return { bookId, categoryNo, categoryLabel: cleanLabel || `${categoryCode || 'OT'}-${categoryNo}` };
}

// Bulk import (used by the Excel importer). Expects an array of row objects.
export async function bulkAddBooks(rows) {
  let inserted = 0;
  let updated = 0;
  let failed = [];
  for (const row of rows) {
    try {
      const suppliedBookId = Number(row.bookId);
      if (Number.isInteger(suppliedBookId) && suppliedBookId > 0) {
        const existing = await runSql(`SELECT id FROM books WHERE book_id = ? LIMIT 1;`, [suppliedBookId]);
        if (existing.rows.length > 0) {
          const cleanLabel = String(row.categoryLabel || '').trim().toUpperCase();
          await runSql(
            `UPDATE books SET category_code = ?, category_label = ?, category_type = ?, book_name = ?, author_name = ?, publication_name = ?, cost = ?, barcode = ? WHERE book_id = ?;`,
            [row.categoryCode || 'OT', cleanLabel || null, row.categoryType || null, row.bookName, row.authorName || null, row.publicationName || null, row.cost ?? null, row.barcode || null, suppliedBookId]
          );
          updated += 1;
          continue;
        }
      }
      await addBook(row);
      inserted += 1;
    } catch (e) {
      failed.push({ row, error: e.message });
    }
  }
  return { inserted, updated, failed };
}

export async function getAllBooks() {
  const result = await runSql(`SELECT * FROM books ORDER BY book_id DESC;`);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}

export async function getCategoryLabels() {
  const result = await runSql(`
    SELECT DISTINCT TRIM(COALESCE(category_label, category_code || '-' || category_no)) AS category
    FROM books
    WHERE TRIM(COALESCE(category_label, category_code || '-' || category_no)) <> ''
    ORDER BY category COLLATE NOCASE ASC;
  `);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i).category);
  return rows;
}

export async function searchBooks({ query = '', categoryCode = '', categoryLabel = '', categoryType = '', status = '' }) {
  let sql = `SELECT * FROM books WHERE 1=1`;
  const params = [];

  if (categoryCode) {
    sql += ` AND category_code = ?`;
    params.push(categoryCode);
  }
  if (categoryLabel) {
    sql += ` AND UPPER(COALESCE(category_label, category_code || '-' || category_no)) = UPPER(?)`;
    params.push(categoryLabel);
  }
  if (categoryType) {
    sql += ` AND category_type = ?`;
    params.push(categoryType);
  }
  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  if (String(query).trim()) {
    sql += ` AND (LOWER(book_name) LIKE LOWER(?) OR LOWER(author_name) LIKE LOWER(?) OR LOWER(publication_name) LIKE LOWER(?) OR LOWER(barcode) LIKE LOWER(?) OR CAST(book_id AS TEXT) LIKE ?)`;
    const like = `%${String(query).trim()}%`;
    params.push(like, like, like, like, like);
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

export async function upsertMember(memberId, name = '', phone = '', address = '') {
  const cleanId = String(memberId || '').trim();
  if (!cleanId) throw new Error('Member ID is required');
  if (!String(name || '').trim()) throw new Error('Member name is required');

  await runSql(
    `INSERT INTO members (member_id, name, phone, address) VALUES (?, ?, ?, ?)
     ON CONFLICT(member_id) DO UPDATE SET name = excluded.name, phone = excluded.phone, address = excluded.address;`,
    [cleanId, String(name).trim(), String(phone || '').trim(), String(address || '').trim()]
  );
}

export async function addMember({ memberId, name, phone, address }) {
  const cleanId = String(memberId || '').trim();
  if (!cleanId) throw new Error('Member ID is required');
  if (!String(name || '').trim()) throw new Error('Member name is required');
  if (!String(phone || '').trim()) throw new Error('Phone number is required');
  if (!String(address || '').trim()) throw new Error('Address is required');

  const existing = await getMember(cleanId);
  if (existing) throw new Error('This Member ID is already registered');

  await runSql(
    `INSERT INTO members (member_id, name, phone, address) VALUES (?, ?, ?, ?);`,
    [cleanId, String(name).trim(), String(phone).trim(), String(address).trim()]
  );
  return await getMember(cleanId);
}

export async function getMember(memberId) {
  const result = await runSql(`SELECT * FROM members WHERE member_id = ?;`, [String(memberId || '').trim()]);
  return result.rows.length > 0 ? result.rows.item(0) : null;
}

export async function getAllMembers() {
  const result = await runSql(`SELECT * FROM members ORDER BY name COLLATE NOCASE ASC;`);
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) rows.push(result.rows.item(i));
  return rows;
}

// ---------- Issue / Return ----------

export async function issueBook({ memberId, bookId }) {
  const cleanMemberId = String(memberId || '').trim();
  if (!cleanMemberId) throw new Error('Member ID is required');
  const member = await getMember(cleanMemberId);
  if (!member) throw new Error('Member not found. Add the member before issuing a book.');

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
    [cleanMemberId, book.book_id, issueDateStr, dueDateStr]
  );
  await runSql(`UPDATE books SET status = 'issued' WHERE book_id = ?;`, [book.book_id]);

  return { issueDate: issueDateStr, dueDate: dueDateStr, book };
}

export async function returnBook({ bookId }) {
  const book = await findBookByBarcodeOrId(bookId);
  if (!book) throw new Error('Book not found');

  const activeIssue = await runSql(
    `SELECT id FROM issues WHERE book_id = ? AND status = 'issued' LIMIT 1;`,
    [book.book_id]
  );
  if (activeIssue.rows.length === 0) throw new Error('This book is not currently issued.');

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
      `INSERT INTO books (book_id, category_code, category_no, category_label, category_type, book_name, author_name, publication_name, cost, barcode, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')));`,
      [
        b.book_id,
        b.category_code,
        b.category_no,
        b.category_label || null,
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
      `INSERT INTO members (member_id, name, phone, address, created_at)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')));`,
      [m.member_id, m.name || null, m.phone || null, m.address || null, m.created_at || null]
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
