// Ícones de traço, desenhados em SVG — combinam com o visual do HUD,
// herdam a cor do texto e não dependem de nenhuma fonte ou biblioteca.

const TRACOS = {
  casa: '<path d="M3.5 10.6 12 3.8l8.5 6.8"/><path d="M5.8 9.4V20h12.4V9.4"/><path d="M10 20v-4.4h4V20"/>',
  agenda: '<rect x="3.2" y="5" width="17.6" height="15.8" rx="2"/><path d="M8 3v4M16 3v4M3.2 10h17.6"/><circle cx="8.6" cy="14" r="1.1" fill="currentColor" stroke="none"/><circle cx="12" cy="14" r="1.1" fill="currentColor" stroke="none"/>',
  pilula: '<rect x="1.6" y="8.4" width="20.8" height="7.2" rx="3.6" transform="rotate(-45 12 12)"/><path d="M8.5 8.5 15.5 15.5"/>',
  carrinho: '<path d="M2.4 3.6h2.3l2.6 10.6a1.8 1.8 0 0 0 1.8 1.4h7.6a1.8 1.8 0 0 0 1.8-1.4l1.5-6.4H6"/><circle cx="9.6" cy="19.6" r="1.5"/><circle cx="17" cy="19.6" r="1.5"/>',
  cartao: '<rect x="2.2" y="5.2" width="19.6" height="13.6" rx="2.2"/><path d="M2.2 9.8h19.6"/><path d="M6 14.6h3.6"/>',
  grafico: '<path d="M3.4 20.4h17.2"/><path d="M6.6 20.4V12M11.6 20.4V4.6M16.6 20.4v-5.6"/>',
  engrenagem: '<path d="M4 7.2h4.6M13.4 7.2H20M4 16.8h6.6M15.4 16.8H20"/><circle cx="11" cy="7.2" r="2.4"/><circle cx="13" cy="16.8" r="2.4"/>',
  sino: '<path d="M6.2 9.6a5.8 5.8 0 0 1 11.6 0c0 4.8 1.9 5.8 1.9 5.8H4.3s1.9-1 1.9-5.8Z"/><path d="M10.1 19.4a2 2 0 0 0 3.8 0"/>',
  raio: '<path d="M13.2 2.4 4.6 13.6h6.3l-1.1 8 8.6-11.2h-6.3z"/>',
  dinheiro: '<path d="M12 2.6v18.8"/><path d="M16.8 6.4H9.9a3.4 3.4 0 0 0 0 6.8h4.2a3.4 3.4 0 0 1 0 6.8H6.6"/>',
  pessoas: '<circle cx="9" cy="8" r="3.2"/><path d="M3.4 20.2a5.6 5.6 0 0 1 11.2 0"/><path d="M16.2 5.2a3.2 3.2 0 0 1 0 5.9M17.6 20.2a5.6 5.6 0 0 0-2.2-4.5"/>',
  paleta: '<path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.2 0 1.8-.8 1.8-1.7 0-1.4-1-1.6-1-2.7 0-.8.7-1.5 1.6-1.5h1.9a4.5 4.5 0 0 0 4.5-4.5c0-4-3.9-7.2-8.8-7.2Z"/><circle cx="7.6" cy="11" r="1.1" fill="currentColor" stroke="none"/><circle cx="11" cy="7.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="15.4" cy="8.6" r="1.1" fill="currentColor" stroke="none"/>',
  sincronizar: '<path d="M20.4 12a8.4 8.4 0 0 1-14.6 5.7"/><path d="M3.6 12a8.4 8.4 0 0 1 14.6-5.7"/><path d="M18.4 2.6v3.8h-3.8M5.6 21.4v-3.8h3.8"/>',
  celular: '<rect x="6.4" y="2.2" width="11.2" height="19.6" rx="2.4"/><path d="M10.4 5.4h3.2"/><path d="M10.8 18.4h2.4"/>',
  relogio: '<circle cx="12" cy="12" r="8.8"/><path d="M12 6.8V12l3.4 2"/>',
  mais: '<path d="M12 5.2v13.6M5.2 12h13.6"/>',
  caixa: '<path d="M3.4 7.4 12 3.2l8.6 4.2v9.2L12 20.8l-8.6-4.2z"/><path d="M3.4 7.4 12 11.6l8.6-4.2M12 11.6v9.2"/>',
  aviso: '<path d="M12 3.4 21.4 19.6H2.6z"/><path d="M12 9.6v4.4"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  escudo: '<path d="M12 2.8 4.6 6v6c0 4.6 3.1 8 7.4 9.2 4.3-1.2 7.4-4.6 7.4-9.2V6z"/><path d="m8.8 12 2.4 2.4 4-4.6"/>',
  lixo: '<path d="M4 6.4h16"/><path d="M9.2 6.4V4.2h5.6v2.2"/><path d="M6.4 6.4 7.3 20a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.9-13.6"/><path d="M10.4 10.4v6.6M13.6 10.4v6.6"/>',
  lapis: '<path d="M16.2 3.4a2.1 2.1 0 0 1 3 3L8.4 17.2l-4 1 1-4z"/><path d="m14.4 5.2 3 3"/>',
  repetir: '<path d="M4 9.2A4.4 4.4 0 0 1 8.4 5H19"/><path d="M16.2 2.2 19.4 5l-3.2 2.8"/><path d="M20 14.8a4.4 4.4 0 0 1-4.4 4.2H5"/><path d="m7.8 21.8-3.2-2.8 3.2-2.8"/>',
  local: '<path d="M12 21.4s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10.2" r="2.6"/>'
};

/**
 * Devolve o SVG do ícone como texto, pronto para interpolar no HTML.
 * A cor vem do `currentColor`, então basta pintar o elemento em volta.
 */
export function icone(nome, tamanho = 22) {
  const tracos = TRACOS[nome];
  if (!tracos) return '';
  return `<svg class="icone" viewBox="0 0 24 24" width="${tamanho}" height="${tamanho}" aria-hidden="true"
    fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round">${tracos}</svg>`;
}

// Ícone correspondente a cada tipo de alerta mostrado na tela inicial.
export const ICONE_POR_TIPO = {
  agenda: 'agenda', farmacia: 'pilula', contas: 'cartao',
  financeiro: 'dinheiro', mercado: 'carrinho'
};
