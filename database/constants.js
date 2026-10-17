// Shared constants (kept separate from db.js so utilities can import them
// without creating circular imports).

export const CATEGORIES = [
  { code: 'N', label: 'Novel', short: 'Novel', color: '#2563EB' },
  { code: 'S', label: 'Story', short: 'Story', color: '#0D9488' },
  { code: 'P', label: 'Poem', short: 'Poem', color: '#9333EA' },
  { code: 'R', label: 'Reference', short: 'Reference', color: '#B45309' },
  { code: 'OT', label: 'Others', short: 'Others', color: '#4B5563' },
  { code: 'CL', label: "Children's literature", short: "Children's", color: '#DB2777' },
  { code: 'B', label: 'Biography/Autobiography', short: 'Biography', color: '#065F46' },
  { code: 'E', label: 'Essay / Memoir', short: 'Essay', color: '#7C3AED' },
  { code: 'SD', label: 'Story-Drama', short: 'Drama', color: '#EA580C' },
];

export const LANGUAGES = ['English', 'Hindi', 'Malayalam', 'Tamil', 'Kannada', 'Telugu', 'Other'];

// Number of days a book can be kept before it is due back.
export const LOAN_DAYS = 15;

export function categoryColor(code) {
  return CATEGORIES.find((c) => c.code === code)?.color || '#0F2747';
}
export function categoryLabel(code) {
  return CATEGORIES.find((c) => c.code === code)?.label || code;
}
