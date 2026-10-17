// Local-time date helpers. The old code used toISOString(), which is UTC and
// gives the WRONG day for users in India between midnight and 5:30 AM.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function addDaysStr(days, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  return toDateStr(d);
}

function parse(str) {
  const [y, m, d] = String(str).split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

// Whole days from today until `dateStr` (negative = overdue).
export function daysUntil(dateStr) {
  const target = parse(dateStr);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}

export function formatDate(dateStr) {
  const d = parse(dateStr);
  if (!d) return dateStr || '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function dueLabel(dateStr) {
  const n = daysUntil(dateStr);
  if (n === null) return { text: dateStr || '—', tone: 'ok' };
  if (n < 0) return { text: `Overdue by ${-n} day${n === -1 ? '' : 's'}`, tone: 'late' };
  if (n === 0) return { text: 'Due today', tone: 'soon' };
  if (n <= 3) return { text: `Due in ${n} day${n === 1 ? '' : 's'}`, tone: 'soon' };
  return { text: `Due ${formatDate(dateStr)}`, tone: 'ok' };
}
