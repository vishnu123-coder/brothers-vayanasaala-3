import { CATEGORIES } from '../database/constants';

// Lower-cases, strips Latin accents and punctuation noise. The SAME function
// is applied to stored text and to what the user types, so Malayalam / Hindi
// text (which may arrive in composed or decomposed Unicode form depending on
// the keyboard) still matches.
export function norm(s) {
  let t = String(s ?? '').toLowerCase();
  try {
    t = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch (e) {
    /* normalize() unavailable — fall back to plain lower-case */
  }
  return t.replace(/[.,'’"“”]/g, '').replace(/\s+/g, ' ').trim();
}

const catLabel = (code) => CATEGORIES.find((c) => c.code === code)?.label || code || '';

// Builds the pre-computed lowercase "haystack" stored on every book once, so
// each keystroke only does cheap string.includes() checks.
export function decorateBook(b) {
  const catNo = `${b.category_code || ''}-${b.category_no || ''}`;
  const hay = norm(
    [
      b.book_name,
      b.author_name,
      b.publication_name,
      b.category_type,
      catLabel(b.category_code),
      catNo,
      `${b.category_code || ''}${b.category_no || ''}`,
      `#${b.book_id}`,
      b.book_id,
      b.barcode,
      b.status,
      b.cost,
    ].join(' ')
  );
  return {
    ...b,
    _hay: hay,
    _name: norm(b.book_name),
    _author: norm(b.author_name),
    _catNo: norm(catNo),
    _barcode: norm(b.barcode),
  };
}

function score(b, q) {
  const id = String(b.book_id);
  if (q === id || q === `#${id}` || (b._barcode && q === b._barcode)) return 100;
  if (q === b._catNo) return 90;
  if (b._name === q) return 80;
  if (b._name.startsWith(q)) return 60;
  if (b._name.includes(q)) return 40;
  if (b._author.includes(q)) return 25;
  return 10;
}

export const SORTS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'name', label: 'A–Z' },
  { key: 'author', label: 'Author' },
];

function sortBooks(list, sort) {
  const copy = list.slice();
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => a.book_id - b.book_id);
    case 'name':
      return copy.sort((a, b) => a._name.localeCompare(b._name));
    case 'author':
      return copy.sort((a, b) => a._author.localeCompare(b._author) || a._name.localeCompare(b._name));
    case 'newest':
    default:
      return copy.sort((a, b) => b.book_id - a.book_id);
  }
}

// Every word typed must appear somewhere in the book's details (AND match),
// in any order — "hemingway sea" finds "The Old Man and the Sea".
export function filterBooks(books, { query = '', categoryCode = '', status = '', sort = 'newest' } = {}) {
  let list = books;
  if (categoryCode) list = list.filter((b) => b.category_code === categoryCode);
  if (status) list = list.filter((b) => b.status === status);

  const q = norm(query);
  if (!q) return sortBooks(list, sort);

  const tokens = q.split(' ');
  const scored = [];
  for (const b of list) {
    let ok = true;
    for (const t of tokens) {
      if (!b._hay.includes(t)) {
        ok = false;
        break;
      }
    }
    if (ok) scored.push({ b, s: score(b, q) });
  }
  scored.sort((x, y) => y.s - x.s || y.b.book_id - x.b.book_id);
  return scored.map((x) => x.b);
}

export function filterMembers(members, query = '') {
  const q = norm(query);
  const list = members.slice().sort((a, b) => norm(a.name || a.member_id).localeCompare(norm(b.name || b.member_id)));
  if (!q) return list;
  const tokens = q.split(' ');
  return list.filter((m) => {
    const hay = norm(`${m.member_id} ${m.name || ''} ${m.phone || ''} ${m.address || ''}`);
    return tokens.every((t) => hay.includes(t));
  });
}
