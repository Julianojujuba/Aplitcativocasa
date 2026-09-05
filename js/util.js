// Utilitários gerais: datas, dinheiro, texto.
// Tudo em pt-BR e sempre em horário LOCAL (nunca UTC) para não errar o dia.

export const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const DIAS_SEMANA_LONGO = ['Domingo', 'Segunda-feira', 'Terça-feira',
  'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

/* ---------- Dinheiro ---------- */

export function fmtMoney(v, { sinal = false } = {}) {
  const n = Number(v) || 0;
  const s = n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  return sinal && n > 0 ? '+' + s : s;
}

export function fmtMoneyCurto(v) {
  const n = Math.abs(Number(v) || 0);
  const sig = (Number(v) || 0) < 0 ? '-' : '';
  if (n >= 1000000) return `${sig}R$ ${(n / 1000000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1000) return `${sig}R$ ${(n / 1000).toFixed(1).replace('.', ',')}k`;
  return fmtMoney(v);
}

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56"
export function parseMoney(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  let s = String(str).replace(/[^\d,.-]/g, '').trim();
  if (!s) return 0;
  const temVirgula = s.includes(',');
  const temPonto = s.includes('.');
  if (temVirgula && temPonto) {
    // O último separador é o decimal
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (temVirgula) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- Datas ---------- */

export function hojeISO() {
  return dataParaISO(new Date());
}

export function dataParaISO(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// 'YYYY-MM-DD' -> Date local à meia-noite (evita o bug de fuso do new Date('...'))
export function isoParaData(iso) {
  if (!iso) return null;
  const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d);
}

export function isoHoraParaData(iso, hora) {
  const d = isoParaData(iso);
  if (!d) return null;
  if (hora && /^\d{1,2}:\d{2}$/.test(hora)) {
    const [h, mi] = hora.split(':').map(Number);
    d.setHours(h, mi, 0, 0);
  }
  return d;
}

export function fmtData(iso) {
  const d = isoParaData(iso);
  if (!d) return '—';
  return d.toLocaleDateString('pt-BR');
}

export function fmtDataCurta(iso) {
  const d = isoParaData(iso);
  if (!d) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function fmtDataExtenso(iso) {
  const d = isoParaData(iso);
  if (!d) return '—';
  return `${DIAS_SEMANA_LONGO[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()}`;
}

export function addDias(iso, n) {
  const d = isoParaData(iso);
  d.setDate(d.getDate() + n);
  return dataParaISO(d);
}

export function addMeses(comp, n) {
  const [a, m] = comp.split('-').map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return competenciaDe(d);
}

export function diasEntre(isoA, isoB) {
  const a = isoParaData(isoA), b = isoParaData(isoB);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

/* ---------- Competência (mês de referência 'YYYY-MM') ---------- */

export function competenciaDe(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function competenciaDoISO(iso) {
  return String(iso || '').slice(0, 7);
}

export function labelCompetencia(comp) {
  const [a, m] = comp.split('-').map(Number);
  return `${MESES[m - 1]} de ${a}`;
}

export function labelCompetenciaCurta(comp) {
  const [a, m] = comp.split('-').map(Number);
  return `${MESES[m - 1].slice(0, 3)}/${String(a).slice(2)}`;
}

export function diasNoMes(comp) {
  const [a, m] = comp.split('-').map(Number);
  return new Date(a, m, 0).getDate();
}

// Data de vencimento real dentro da competência (ajusta dia 31 em fevereiro etc.)
export function vencimentoNaCompetencia(comp, dia) {
  const max = diasNoMes(comp);
  const d = Math.min(Math.max(Number(dia) || 1, 1), max);
  return `${comp}-${String(d).padStart(2, '0')}`;
}

/* ---------- Texto ---------- */

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function uid(prefixo = 'id') {
  return `${prefixo}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function plural(n, singular, pluralForma) {
  return n === 1 ? `1 ${singular}` : `${n} ${pluralForma}`;
}

export function iniciais(nome) {
  return String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}
