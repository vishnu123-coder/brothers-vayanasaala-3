

import * as SQLite from 'expo-sqlite/legacy';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import { auth, db as firestoreDb } from '../firebase';

const db = SQLite.openDatabase('libratrack.db');

export const CATEGORIES = [
  { code: 'N', label: 'Novel' },
  { code: 'S', label: 'Story' },
  { code: 'P', label: 'Poem' },
  { code: 'R', label: 'Reference' },
  { code: 'OT', label: 'Others' },
  { code: 'CL', label: "Children's literature" },
  { code: 'B', label: 'Biography/Autobiography' },
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

function rowsToArray(result) {
  const rows = [];

  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }

  return rows;
}

function clean(value) {
  return String(value ?? '').trim();
}

async function safeCloudOperation(operation) {
  try {
    if (!auth.currentUser) {
      return null;
    }

    return await operation();
  } catch (error) {
    console.log(
      'Cloud operation warning:',
      error?.message || error
    );

    return null;
  }
}

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

        tx.executeSql(
          CREATE INDEX IF NOT EXISTS idx_members_name
          ON members(name);
        );

        tx.executeSql(
          PRAGMA table_info(books);,
          [],
          (_, result) => {
            let exists = false;

            for (let i = 0; i < result.rows.length; i++) {
              if (
                result.rows.item(i).name ===
                'category_label'
              ) {
                exists = true;
                break;
              }
            }

            if (!exists) {
              tx.executeSql(
                ALTER TABLE books ADD COLUMN category_label TEXT;
              );
            }

            return false;
          }
        );

        tx.executeSql(
          PRAGMA table_info(members);,
          [],
          (_, result) => {
            let exists = false;
           for (let i = 0; i < result.rows.length; i++) {
              if (
                result.rows.item(i).name ===
                'address'
              ) {
                exists = true;
                break;
              }
            }

            if (!exists) {
              tx.executeSql(
                ALTER TABLE members ADD COLUMN address TEXT;
              );
            }

            return false;
          }
        );
      },
      (error) => reject(error),
      () => resolve(true)
    );
  });
}

export async function getNextBookId() {
  const result = await runSql(
    SELECT MAX(book_id) AS maxId FROM books;
  );

  return (result.rows.item(0).maxId || 0) + 1;
}

export async function getNextCategoryNo(categoryCode) {
  const result = await runSql(
    
      SELECT MAX(category_no) AS maxNo
      FROM books
      WHERE category_code = ?;
    ,
    [categoryCode]
  );

  return (result.rows.item(0).maxNo || 0) + 1;
}

function bookCloudData(book) {
  return {
    id: book.id ?? null,
    book_id: book.book_id,
    category_code: book.category_code ?? 'OT',
    category_no: book.category_no ?? 0,
    category_label: book.category_label ?? null,
    category_type: book.category_type ?? null,
    book_name: book.book_name ?? '',
    author_name: book.author_name ?? null,
    publication_name: book.publication_name ?? null,
    cost: book.cost ?? null,
    barcode: book.barcode ?? null,
    status: book.status ?? 'available',
    created_at: book.created_at ?? null,
  };
}

async function uploadBook(book) {
  return safeCloudOperation(() =>
    setDoc(
      doc(
        firestoreDb,
        'books',
        String(book.book_id)
      ),
      bookCloudData(book)
    )
  );
}

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

  const categoryNo = await getNextCategoryNo(
    categoryCode || 'OT'
  );

  const cleanLabel = clean(categoryLabel).toUpperCase();

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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    ,
    [
      bookId,
      categoryCode || 'OT',
      categoryNo,
      cleanLabel || null,
      categoryType || null,
      bookName,
      authorName || null,
      publicationName || null,
      cost ?? null,
      barcode || null,
    ]
  );

  const result = await runSql(
    SELECT * FROM books WHERE book_id = ?;,
    [bookId]
  );

  const book = result.rows.item(0);

  await uploadBook(book);

  return {
    bookId,
    categoryNo,
    categoryLabel:
      cleanLabel ||
      ${categoryCode || 'OT'}-${categoryNo},
  };
}

export async function bulkAddBooks(rows) {
  let inserted = 0;
  let updated = 0;

  const failed = [];

  for (const row of rows) {
    try {
      const suppliedBookId = Number(row.bookId);

      if (
        Number.isInteger(suppliedBookId) &&
        suppliedBookId > 0
      ) {
        const existing = await runSql(
          
            SELECT id
            FROM books
            WHERE book_id = ?
            LIMIT 1;
          ,
          [suppliedBookId]
        );

        if (existing.rows.length > 0) {
          const cleanLabel = clean(
            row.categoryLabel
          ).toUpperCase();

          await runSql(
            `
              UPDATE books SET
                category_code = ?,
                category_label = ?,
                category_no =
                  COALESCE(?, category_no),
                category_type = ?,
                book_name = ?,
                author_name = ?,
                publication_name = ?,
                cost = ?,
                barcode = ?
              WHERE book_id = ?;
            ,
            [
              row.categoryCode || 'OT',
              cleanLabel || null,
              row.categoryNo
                ? Number(row.categoryNo)
                : null,
              row.categoryType || null,
              row.bookName,
              row.authorName || null,
              row.publicationName || null,
              row.cost ?? null,
              row.barcode || null,
              suppliedBookId,
            ]
          );

          const updatedResult = await runSql(
            
              SELECT *
              FROM books
              WHERE book_id = ?;
            ,
            [suppliedBookId]
          );

          await uploadBook(
            updatedResult.rows.item(0)
          );

          updated += 1;
          continue;
        }
      }

      await addBook(row);

      inserted += 1;
    } catch (e) {
      failed.push({
        row,
        error: e?.message || String(e),
      });
    }
  }

  return {
    inserted,
    updated,
    failed,
  };
}

export const bulkImportLibraryBooks =
  bulkAddBooks;

export async function getAllBooks() {
  const result = await runSql(
    
      SELECT *
      FROM books
      ORDER BY book_id DESC;
    
  );

  return rowsToArray(result);
}

export async function getCategoryLabels() {
  const result = await runSql(
    SELECT DISTINCT
      TRIM(
        COALESCE(
          category_label,
          category_code  '-'  category_no
        )
      ) AS category
    FROM books
    WHERE TRIM(
      COALESCE(
        category_label,
        category_code  '-'  category_no
      )
    ) <> ''
    ORDER BY category COLLATE NOCASE ASC;
  );

  return rowsToArray(result).map(
    (row) => row.category
  );
}

export async function searchBooks({
  query = '',
  categoryCode = '',
  categoryLabel = '',
  categoryType = '',
  status = '',
}) {
  let sql = 
    SELECT *
    FROM books
    WHERE 1=1
  ;

  const params = [];

  if (categoryCode) {
    sql += 
      AND category_code = ?
    ;

    params.push(categoryCode);
  }

  if (categoryLabel) {
    sql += 
      AND UPPER(
        COALESCE(
          category_label,
          category_code  '-'  category_no
        )
      ) = UPPER(?)
    ;

    params.push(categoryLabel);
  }

  if (categoryType) {
    sql += 
      AND category_type = ?
    ;

    params.push(categoryType);
  }

  if (status) {
    sql += 
      AND status = ?
    ;

    params.push(status);
  }

  if (clean(query)) {
    const like = %${clean(query)}%;

    sql += 
      AND (
        LOWER(book_name) LIKE LOWER(?) OR
        LOWER(author_name) LIKE LOWER(?) OR
        LOWER(publication_name) LIKE LOWER(?) OR
        LOWER(barcode) LIKE LOWER(?) OR
        CAST(book_id AS TEXT) LIKE ?
      )
    ;

    params.push(
      like,
      like,
      like,
      like,
      like
    );
  }

  sql += 
    ORDER BY book_id DESC;
  ;

  const result = await runSql(
    sql,
    params
  );

  return rowsToArray(result);
}

export async function findBookByBarcodeOrId(
  value
) {
  const result = await runSql(
    
      SELECT *
      FROM books
      WHERE barcode = ?
         OR book_id = ?
      LIMIT 1;
    ,
    [
      value,
      Number.isNaN(Number(value))
        ? -1
        : Number(value),
    ]
  );

  return result.rows.length > 0
    ? result.rows.item(0)
    : null;
}

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
    
      SELECT category_code, COUNT(*) AS c
      FROM books
      GROUP BY category_code;
    `
  );
         return {
    total: total.rows.item(0).c,
    issued: issued.rows.item(0).c,
    available:
      available.rows.item(0).c,
    byCategory: rowsToArray(
      byCategory
    ),
  };
}

function memberCloudData(member) {
  return {
    id: member.id ?? null,
    member_id: member.member_id,
    name: member.name ?? '',
    phone: member.phone ?? '',
    address: member.address ?? '',
    created_at: member.created_at ?? null,
  };
}

async function uploadMember(member) {
  return safeCloudOperation(() =>
    setDoc(
      doc(
        firestoreDb,
        'members',
        String(member.member_id)
      ),
      memberCloudData(member)
    )
  );
}

export async function upsertMember(
  memberId,
  name = '',
  phone = '',
  address = ''
) {
  const cleanId = clean(memberId);

  if (!cleanId) {
    throw new Error(
      'Member ID is required'
    );
  }

  if (!clean(name)) {
    throw new Error(
      'Member name is required'
    );
  }

  await runSql(
    
      INSERT INTO members
        (
          member_id,
          name,
          phone,
          address
        )
      VALUES (?, ?, ?, ?)
      ON CONFLICT(member_id)
      DO UPDATE SET
        name = excluded.name,
        phone = excluded.phone,
        address = excluded.address;
    ,
    [
      cleanId,
      clean(name),
      clean(phone),
      clean(address),
    ]
  );

  const result = await runSql(
    
      SELECT *
      FROM members
      WHERE member_id = ?;
    ,
    [cleanId]
  );

  await uploadMember(
    result.rows.item(0)
  );
}

export async function addMember({
  memberId,
  name,
  phone,
  address,
}) {
  const cleanId = clean(memberId);

  if (!cleanId) {
    throw new Error(
      'Member ID is required'
    );
  }

  if (!clean(name)) {
    throw new Error(
      'Member name is required'
    );
  }

  if (!clean(phone)) {
    throw new Error(
      'Phone number is required'
    );
  }

  if (!clean(address)) {
    throw new Error(
      'Address is required'
    );
  }

  const existing = await getMember(
    cleanId
  );

  if (existing) {
    throw new Error(
      'This Member ID is already registered'
    );
  }

  await runSql(
    
      INSERT INTO members
        (
          member_id,
          name,
          phone,
          address
        )
      VALUES (?, ?, ?, ?);
    ,
    [
      cleanId,
      clean(name),
      clean(phone),
      clean(address),
    ]
  );

  const member = await getMember(
    cleanId
  );

  await uploadMember(member);

  return member;
}

export async function getMember(
  memberId
) {
  const result = await runSql(
    
      SELECT *
      FROM members
      WHERE member_id = ?;
    ,
    [clean(memberId)]
  );

  return result.rows.length > 0
    ? result.rows.item(0)
    : null;
}

export async function getAllMembers() {
  const result = await runSql(
    
      SELECT *
      FROM members
      ORDER BY name COLLATE NOCASE ASC;
    
  );

  return rowsToArray(result);
}

async function uploadIssue(issue) {
  return safeCloudOperation(() =>
    setDoc(
      doc(
        firestoreDb,
        'issues',
        String(issue.id)
      ),
      {
        id: issue.id,
        member_id: issue.member_id,
        book_id: issue.book_id,
        issue_date: issue.issue_date,
        due_date: issue.due_date,
        return_date:
          issue.return_date ?? null,
        status:
          issue.status ?? 'issued',
      }
    )
  );
}

export async function issueBook({
  memberId,
  bookId,
}) {
  const cleanMemberId = clean(
    memberId
  );

  if (!cleanMemberId) {
    throw new Error(
      'Member ID is required'
    );
  }

  const member = await getMember(
    cleanMemberId
  );

  if (!member) {
    throw new Error(
      'Member not found. Add the member before issuing a book.'
    );
  }

  const book =
    await findBookByBarcodeOrId(bookId);

  if (!book) {
    throw new Error(
      'Book not found'
    );
  }

  if (book.status === 'issued') {
    throw new Error(
      'This book is already issued'
    );
  }
 const issueDate = new Date();
  const dueDate = new Date();

  dueDate.setDate(
    issueDate.getDate() + 15
  );

  const issueDateStr =
    issueDate
      .toISOString()
      .split('T')[0];

  const dueDateStr =
    dueDate
      .toISOString()
      .split('T')[0];

  await runSql(
    
      INSERT INTO issues
        (
          member_id,
          book_id,
          issue_date,
          due_date,
          status
        )
      VALUES (?, ?, ?, ?, 'issued');
    ,
    [
      cleanMemberId,
      book.book_id,
      issueDateStr,
      dueDateStr,
    ]
  );

  await runSql(
    
      UPDATE books
      SET status = 'issued'
      WHERE book_id = ?;
    ,
    [book.book_id]
  );

  const issueResult = await runSql(
    
      SELECT *
      FROM issues
      WHERE member_id = ?
        AND book_id = ?
        AND status = 'issued'
      ORDER BY id DESC
      LIMIT 1;
    ,
    [
      cleanMemberId,
      book.book_id,
    ]
  );

  const issue =
    issueResult.rows.item(0);

  const updatedBookResult =
    await runSql(
      
        SELECT *
        FROM books
        WHERE book_id = ?;
      ,
      [book.book_id]
    );

  await uploadIssue(issue);

  await uploadBook(
    updatedBookResult.rows.item(0)
  );

  return {
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    book,
  };
}

export async function returnBook({
  bookId,
}) {
  const book =
    await findBookByBarcodeOrId(bookId);

  if (!book) {
    throw new Error(
      'Book not found'
    );
  }

  const activeIssue = await runSql(
    
      SELECT id
      FROM issues
      WHERE book_id = ?
        AND status = 'issued'
      LIMIT 1;
    ,
    [book.book_id]
  );

  if (activeIssue.rows.length === 0) {
    throw new Error(
      'This book is not currently issued.'
    );
  }

  const returnDateStr =
    new Date()
      .toISOString()
      .split('T')[0];

  await runSql(
    
      UPDATE issues
      SET
        return_date = ?,
        status = 'returned'
      WHERE book_id = ?
        AND status = 'issued';
    ,
    [
      returnDateStr,
      book.book_id,
    ]
  );

  await runSql(
    
      UPDATE books
      SET status = 'available'
      WHERE book_id = ?;
    ,
    [book.book_id]
  );

  const issueResult = await runSql(
    
      SELECT *
      FROM issues
      WHERE id = ?;
    ,
    [
      activeIssue.rows.item(0).id,
    ]
  );

  const updatedBookResult =
    await runSql(
      
        SELECT *
        FROM books
        WHERE book_id = ?;
      ,
      [book.book_id]
    );

  await uploadIssue(
    issueResult.rows.item(0)
  );

  await uploadBook(
    updatedBookResult.rows.item(0)
  );

  return {
    returnDate: returnDateStr,
    book,
  };
}

export async function getActiveIssues() {
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

  return rowsToArray(result);
}

export async function getAllIssuesFull() {
  const result = await runSql(
    
      SELECT *
      FROM issues
      ORDER BY id ASC;
    
  );

  return rowsToArray(result);
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

export function clearAllData() {
  return new Promise(
    (resolve, reject) => {
      db.transaction(
        (tx) => {
          tx.executeSql(
            DELETE FROM issues;
          );

          tx.executeSql(
            DELETE FROM books;
          );

          tx.executeSql(
            DELETE FROM members;
          );
        },
        (error) => reject(error),
        () => resolve(true)
      );
    }
  );
}

export async function restoreFullBackup({
  books =[],
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
        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          COALESCE(?, datetime('now'))
        );
      ,
      [
        b.book_id,
        b.category_code || 'OT',
        b.category_no || 0,
        b.category_label || null,
        b.category_type || null,
        b.book_name,
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
        VALUES
        (
          ?,
          ?,
          ?,
          ?,
          COALESCE(?, datetime('now'))
        );
      ,
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
          id,
          member_id,
          book_id,
          issue_date,
          due_date,
          return_date,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?);
      ,
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
  }

  await syncLocalToCloud();

  return {
    books: books.length,
    members: members.length,
    issues: issues.length,
  };
}

export async function syncLocalToCloud() {
  if (!auth.currentUser) {
    return {
      uploaded: 0,
    };
  }

  const [
    books,
    members,
    issues,
  ] = await Promise.all([
    getAllBooks(),
    getAllMembers(),
    getAllIssuesFull(),
  ]);

  let batch = writeBatch(firestoreDb);
  let operations = 0;
  let uploaded = 0;

  const commitIfNeeded = async () => {
    if (operations === 0) {
      return;
    }

    await batch.commit();

    batch = writeBatch(firestoreDb);
    operations = 0;
  };

  for (const book of books) {
    batch.set(
      doc(
        firestoreDb,
        'books',
        String(book.book_id)
      ),
      bookCloudData(book)
    );

    operations += 1;
    uploaded += 1;

    if (operations >= 450) {
      await commitIfNeeded();
    }
  }

  for (const member of members) {
    batch.set(
      doc(
        firestoreDb,
        'members',
        String(member.member_id)
      ),
      memberCloudData(member)
    );

    operations += 1;
    uploaded += 1;

    if (operations >= 450) {
      await commitIfNeeded();
    }
  }

  for (const issue of issues) {
    batch.set(
      doc(
        firestoreDb,
        'issues',
        String(issue.id)
      ),
      {
        id: issue.id,
        member_id: issue.member_id,
        book_id: issue.book_id,
        issue_date: issue.issue_date,
        due_date: issue.due_date,
        return_date: issue.return_date ?? null,
        status: issue.status ?? 'issued',
      }
    );

    operations += 1;
    uploaded += 1;

    if (operations >= 450) {
      await commitIfNeeded();
    }
  }

  await commitIfNeeded();

  return {
    uploaded,
  };
}

export async function syncCloudToLocal() {
  if (!auth.currentUser) {
    return {
      downloaded: 0,
    };
  }
 const [
    bookSnapshot,
    memberSnapshot,
    issueSnapshot,
  ] = await Promise.all([
    getDocs(
      collection(
        firestoreDb,
        'books'
      )
    ),
    getDocs(
      collection(
        firestoreDb,
        'members'
      )
    ),
    getDocs(
      collection(
        firestoreDb,
        'issues'
      )
    ),
  ]);

  let downloaded = 0;

  for (const item of bookSnapshot.docs) {
    const b = item.data();

    if (!b.book_id) {
      continue;
    }

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
          status,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
      ,
      [
        Number(b.book_id),
        b.category_code || 'OT',
        Number(b.category_no || 0),
        b.category_label || null,
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

    downloaded += 1;
  }

  for (const item of memberSnapshot.docs) {
    const m = item.data();

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
        VALUES (?, ?, ?, ?, ?);
      ,
      [
        String(m.member_id),
        m.name || '',
        m.phone || '',
        m.address || '',
        m.created_at || null,
      ]
    );

    downloaded += 1;
  }

  for (const item of issueSnapshot.docs) {
    const i = item.data();

    if (i.id == null) {
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
        VALUES (?, ?, ?, ?, ?, ?, ?);
      ,
      [
        Number(i.id),
        String(i.member_id || ''),
        Number(i.book_id),
        i.issue_date || '',
        i.due_date || '',
        i.return_date || null,
        i.status || 'issued',
      ]
    );

    downloaded += 1;
  }

  return {
    downloaded,
  };
}

export default db;
   
 
