const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2
});

export const fmt = value => peso.format(+value || 0);
export const pct = value => ((+value || 0) * 100).toFixed(1) + '%';
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));
export const pad = value => String(value).padStart(2, '0');
export const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
export const P = value => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};
export const today = () => iso(new Date());
export const eom = (year, month) => new Date(year, month + 1, 0);
export const payday30 = (year, month) => {
  const end = eom(year, month).getDate();
  return new Date(year, month, Math.min(30, end));
};
export const inR = (date, start, end) => date && date >= start && date <= end;
export const sum = (items, select = item => item.amount) =>
  items.reduce((total, item) => total + (+select(item) || 0), 0);
export const nice = value => value ? P(value).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric'
}) : '';
export const short = date => date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
export const cap = value => value.charAt(0).toUpperCase() + value.slice(1);
export const isCash = expense => expense.paidFrom !== 'Goal Funds';
export const savSigned = saving => saving.action === 'Deposit' ? +saving.amount : saving.action === 'Withdrawal' ? -saving.amount : 0;
export const parseAmt = value => +String(value ?? '').replace(/[^\d.]/g, '') || 0;

export function fmtAmtInput(value) {
  let text = String(value ?? '').replace(/[^\d.]/g, '');
  if (text === '') return '';
  const decimal = text.indexOf('.');
  if (decimal >= 0) text = text.slice(0, decimal + 1) + text.slice(decimal + 1).replace(/\./g, '');
  let [whole, fraction] = text.split('.');
  whole = (whole || '').replace(/^0+(?=\d)/, '');
  const formatted = whole ? Number(whole).toLocaleString('en-US') : '0';
  return fraction !== undefined ? formatted + '.' + fraction.slice(0, 2) : formatted;
}
