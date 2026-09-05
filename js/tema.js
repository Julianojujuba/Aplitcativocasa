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
