import { CATEGORIES, LANGUAGES } from '../database/db';

const VALID_CODES = CATEGORIES.map((c) => c.code);

// Case/space-insensitive header lookup: returns the raw cell value for the
// first header in `row` whose normalized name is in `keys`.
function get(row, keys) {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[\s_./:-]/g, '');
    if (keys.includes(norm)) return row[k];
  }
  return '';
}

// Maps a single-letter/short language code (as seen in "N-M", "SD-H", etc.)
// to a full language name used by the app's dropdown.
function expandLanguageCode(code) {
  const map = { M: 'Malayalam', E: 'English', H: 'Hindi', T: 'Tamil', K: 'Kannada', TE: 'Telugu' };
  const upper = String(code).trim().toUpperCase();
  return map[upper] || (LANGUAGES.includes(code) ? code : LANGUAGES[0]);
}

// Parses ONE row from an uploaded Excel sheet into the shape the database
// functions expect. Understands two formats:
//
// 1) The simple "Add Book" template — separate columns:
//    categoryCode, categoryType, bookName, authorName, publicationName, cost, barcode
//
// 2) A real library register export — combined columns, e.g.:
//    "Book Stock No" (1, 2, 3…) — the original physical Book ID, must be preserved
//    "Book Category No" ("N-20", "SD-77") — category code + number combined
//    "Book ID" (an ISBN/barcode like 9788182645325 or BV010439) — this is actually the barcode
//    "Book Name", "Author Name", "Category Type" ("N-M" = category-language combined),
//    "Publisher Name"/"Publication Name", "Cost"
export function parseLibraryRow(row) {
  // --- Category code + number ---
  let categoryCode = String(get(row, ['categorycode'])).trim().toUpperCase();
  let categoryNo = null;

  const combinedCatNo = String(get(row, ['bookcategoryno', 'categoryno', 'catno'])).trim();
  if (combinedCatNo) {
    const parts = combinedCatNo.split('-');
    if (parts.length >= 2) {
      const codeGuess = parts[0].trim().toUpperCase();
      const numGuess = parseInt(parts.slice(1).join('-'), 10);
      if (VALID_CODES.includes(codeGuess)) categoryCode = codeGuess;
      if (!isNaN(numGuess)) categoryNo = numGuess;
    }
  }
  if (!VALID_CODES.includes(categoryCode)) {
    // Last resort: try a bare "category" column that might just hold the code.
    const bare = String(get(row, ['category'])).trim().toUpperCase();
    categoryCode = VALID_CODES.includes(bare) ? bare : 'OT';
  }

  // --- Category type / language (may come combined like "N-M") ---
  let categoryType = String(get(row, ['categorytype', 'language'])).trim();
  if (categoryType.includes('-')) {
    const langPart = categoryType.split('-').slice(1).join('-');
    categoryType = expandLanguageCode(langPart);
  } else if (categoryType) {
    categoryType = expandLanguageCode(categoryType);
  } else {
    categoryType = LANGUAGES[0];
  }

  // --- Original stock number (Book ID), if this is a real register export ---
  const stockNoRaw = get(row, ['bookstockno', 'stockno', 'slno']);
  const bookId = stockNoRaw !== '' && !isNaN(parseInt(stockNoRaw, 10)) ? parseInt(stockNoRaw, 10) : null;

  // --- Barcode: their "Book ID" column is actually an ISBN/barcode, not our internal id ---
  const barcode = String(get(row, ['barcode', 'bookid', 'isbn'])).trim();

  return {
    bookId,
    categoryCode,
    categoryNo,
    categoryType,
    bookName: String(get(row, ['bookname', 'name', 'title'])).trim(),
    authorName: String(get(row, ['authorname', 'author'])).trim(),
    publicationName: String(get(row, ['publicationname', 'publication', 'publishername', 'publisher'])).trim(),
    cost: parseFloat(get(row, ['cost', 'price'])) || null,
    barcode,
  };
}
