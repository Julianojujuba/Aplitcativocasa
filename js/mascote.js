// O ajudante da casa: um droidezinho que fica num canto e comemora junto.
// Puramente decorativo — se estiver desligado nos Ajustes, nem entra na tela.
import { obter } from './store.js';

const FALAS = {
  evento: ['Anotado! 📌', 'Tá na agenda.', 'Pode deixar comigo. 👀', 'Não vou deixar esquecer.'],
  feito: ['Feito! ✅', 'Mais um riscado.', 'Boa!'],
  dose: ['Remédio em dia. 💚', 'Saúde em primeiro lugar.', 'Isso!'],
  conta: ['Menos uma! 🎉', 'Conta paga. Respira.', 'Boa, tá em dia.'],
  mercado: ['Anotei na lista. 🛒', 'Tá no carrinho.', 'Guardado aqui.'],
  compra: ['Compra registrada. 🧾', 'Já lancei no financeiro.'],
  gasto: ['Lançado. 💸', 'Anotei o gasto.'],
  receita: ['Entrou dinheiro! 🤑', 'Boa notícia dessas eu gosto.'],
  salario: ['Salário na conta! 🎊', 'Chegou!'],
  sincronizou: ['Os dois celulares em dia. 🔄', 'Tudo sincronizado.'],
  ocioso: ['Tô de olho aqui. 👁️', 'Precisa de alguma coisa?', 'Tudo tranquilo por aqui.',
           'Qualquer coisa é só chamar.']
};

let caixa = null;
let sumir = null;

function ligado() {
  return obter().config?.mascote !== false;
}

const CORPO = `
<svg class="mascote__corpo" viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">
  <!-- antena -->
  <line x1="32" y1="6" x2="32" y2="14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <circle class="mascote__luz" cx="32" cy="5" r="3.2" fill="currentColor"/>
  <!-- cabeça -->
  <rect x="12" y="14" width="40" height="32" rx="12"
        fill="var(--cor-superficie-2)" stroke="currentColor" stroke-width="2"/>
  <!-- visor -->
  <rect x="17" y="21" width="30" height="16" rx="8" fill="hsl(var(--matiz) 85% 55% / .16)"/>
  <g class="mascote__olhos" fill="currentColor">
    <rect x="23" y="26" width="5" height="7" rx="2.5"/>
    <rect x="36" y="26" width="5" height="7" rx="2.5"/>
  </g>
  <!-- reator no peito -->
  <circle class="mascote__reator" cx="32" cy="52" r="6" fill="none" stroke="currentColor" stroke-width="2"/>
  <circle cx="32" cy="52" r="2.2" fill="currentColor"/>
  <!-- bracinhos -->
  <line x1="10" y1="30" x2="4" y2="34" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <line x1="54" y1="30" x2="60" y2="34" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
</svg>`;

export function montar() {
  desmontar();
  if (!ligado()) return;

  caixa = document.createElement('div');
  caixa.className = 'mascote';
  caixa.innerHTML = `
    <div class="mascote__balao" hidden></div>
    <button class="mascote__botao" aria-label="Ajudante da casa">${CORPO}</button>`;
  document.body.appendChild(caixa);

  caixa.querySelector('.mascote__botao').addEventListener('click', () => {
    reagir('ocioso');
  });
  window.addEventListener('casa-acao', aoReceberAcao);
}

export function desmontar() {
  window.removeEventListener('casa-acao', aoReceberAcao);
  clearTimeout(sumir);
  caixa?.remove();
  caixa = null;
}

function aoReceberAcao(e) {
  reagir(e.detail?.tipo);
}

export function reagir(tipo) {
  if (!caixa) return;
  const falas = FALAS[tipo] || FALAS.ocioso;
  const balao = caixa.querySelector('.mascote__balao');
  const corpo = caixa.querySelector('.mascote__corpo');

  balao.textContent = falas[Math.floor(Math.random() * falas.length)];
  balao.hidden = false;
  requestAnimationFrame(() => balao.classList.add('is-visivel'));

  corpo.classList.remove('is-feliz');
  void corpo.offsetWidth;              // reinicia a animação
  corpo.classList.add('is-feliz');

  clearTimeout(sumir);
  sumir = setTimeout(() => {
    balao.classList.remove('is-visivel');
    setTimeout(() => { if (balao) balao.hidden = true; }, 260);
  }, 3400);
}

// Liga e desliga sem precisar recarregar o app.
export function atualizarPresenca() {
  if (ligado() && !caixa) montar();
  else if (!ligado() && caixa) desmontar();
}
