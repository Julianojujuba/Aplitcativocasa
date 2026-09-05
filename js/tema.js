// Tema claro/escuro/automático.
const COR_BARRA = { claro: '#eef3fa', escuro: '#05080f' };

export function aplicarTema(tema = 'auto') {
  const raiz = document.documentElement;
  if (tema === 'auto') raiz.removeAttribute('data-tema');
  else raiz.setAttribute('data-tema', tema);

  // O padrão do app é escuro: "auto" só clareia se o sistema pedir tema claro.
  const escuro = tema === 'escuro'
    || (tema === 'auto' && !window.matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', escuro ? COR_BARRA.escuro : COR_BARRA.claro);
}

export function observarTemaDoSistema(obterTemaAtual) {
  window.matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (obterTemaAtual() === 'auto') aplicarTema('auto');
    });
}

/* ---------- Cor de destaque ---------- */

// A folha de estilo inteira nasce de uma matiz; trocar esse número
// repinta o app todo — brilhos, bordas, gráficos e botões juntos.
export const PALETAS = [
  { chave: 'reator', nome: 'Reator', matiz: 189 },
  { chave: 'oceano', nome: 'Oceano', matiz: 212 },
  { chave: 'lilas', nome: 'Lilás', matiz: 280 },
  { chave: 'rosa', nome: 'Rosa', matiz: 332 },
  { chave: 'rubi', nome: 'Rubi', matiz: 352 },
  { chave: 'ambar', nome: 'Âmbar', matiz: 38 },
  { chave: 'menta', nome: 'Menta', matiz: 158 }
];

export const MATIZ_PADRAO = 189;

export function aplicarCor(matiz) {
  const n = Number(matiz);
  document.documentElement.style.setProperty(
    '--matiz', String(Number.isFinite(n) ? ((n % 360) + 360) % 360 : MATIZ_PADRAO)
  );
}

// Converte a cor escolhida no seletor do celular para a matiz do app.
export function matizDoHex(hex) {
  const m = String(hex).trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) return MATIZ_PADRAO;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return MATIZ_PADRAO;                 // cinza não tem matiz
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return Math.round(((h * 60) % 360 + 360) % 360);
}

export function hexDaMatiz(matiz) {
  // Só para pintar o seletor de cor com a matiz atual.
  const h = Number(matiz) / 360, s = 0.85, l = 0.55;
  const f = (n) => {
    const k = (n + h * 12) % 12;
    const a = s * Math.min(l, 1 - l);
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
