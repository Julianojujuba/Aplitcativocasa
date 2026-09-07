// Ponto de entrada: navegação entre telas, service worker e ciclo de avisos.
import { obter, alterar, inscrever, garantirPessoa } from './store.js';
import { aplicarTema, observarTemaDoSistema, aplicarCor } from './tema.js';
import { montar as montarMascote } from './mascote.js';
import { relerAgendaSeNecessario } from './googleagenda.js';
import { definirRegistroSW, iniciarMonitoramento, alertasParaExibir, verificarEDisparar,
  permissaoNotificacao, pedirPermissao, tentarSyncPeriodico } from './notify.js';
import { aviso } from './ui.js';
import { icone } from './icones.js';
import { iniciarSincronizacaoAutomatica, sincronizarEmBreve, estaConectado, usuarioAtual, sair } from './nuvem.js';

import * as inicio from './views/inicio.js';
import * as agenda from './views/agenda.js';
import * as farmacia from './views/farmacia.js';
import * as mercado from './views/mercado.js';
import * as contas from './views/contas.js';
import * as financeiro from './views/financeiro.js';
import * as config from './views/config.js';
import { precisaDeBoasVindas, abrirBoasVindas } from './views/boasvindas.js';

const TELAS = { inicio, agenda, farmacia, mercado, contas, financeiro, config };
const MENU = ['inicio', 'agenda', 'farmacia', 'mercado', 'contas', 'financeiro'];

let telaAtual = 'inicio';
const conteudo = document.getElementById('conteudo');

function rotaAtual() {
  const nome = (location.hash || '#/inicio').replace(/^#\//, '').split('?')[0];
  return TELAS[nome] ? nome : 'inicio';
}

function desenhar() {
  telaAtual = rotaAtual();
  const tela = TELAS[telaAtual];
  document.getElementById('titulo-tela').textContent = tela.titulo;
  document.title = `${tela.titulo} · Nossa Casa`;
  conteudo.scrollTop = 0;
  tela.render(conteudo);
  atualizarMenu();
  atualizarSino();
}

function atualizarMenu() {
  document.querySelectorAll('.menu__item').forEach((el) => {
    el.classList.toggle('is-ativo', el.dataset.tela === telaAtual);
    el.setAttribute('aria-current', el.dataset.tela === telaAtual ? 'page' : 'false');
  });
}

// Selinho no cabeçalho dizendo se os dois celulares estão ligados.
// Versões antigas usavam duas fichas fixas iguais nos dois celulares, e um
// nome apagava o outro. Passa o nome já escolhido para a ficha da conta.
function migrarPessoaDaConta() {
  const usuario = usuarioAtual();
  if (!usuario) return;
  const d = obter();
  const antiga = d.pessoas.find((p) => p.id === d.config.pessoaId);
  const nome = antiga && !antiga.dono && !['Eu', 'Esposa'].includes(antiga.nome)
    ? antiga.nome : undefined;
  garantirPessoa(usuario.id, nome ? { nome, cor: antiga.cor } : {});
}

function atualizarSelo() {
  const selo = document.getElementById('selo-nuvem');
  if (!selo) return;
  const ligado = estaConectado();
  selo.hidden = !ligado;
  if (!ligado) return;
  const erro = obter().nuvem?.ultimoErro;
  selo.classList.toggle('is-erro', Boolean(erro));
  selo.title = erro ? `Sincronização com problema: ${erro}` : 'Sincronizado com o outro celular';
}

function atualizarSino() {
  const n = alertasParaExibir().length;
  const sino = document.getElementById('sino');
  const contador = document.getElementById('sino-contador');
  contador.textContent = n > 9 ? '9+' : String(n);
  contador.hidden = n === 0;
  sino.classList.toggle('tem-alerta', n > 0);
}

function montarMenu() {
  document.getElementById('menu').innerHTML = MENU.map((nome) => `
    <a class="menu__item" href="#/${nome}" data-tela="${nome}">
      <span class="menu__icone">${icone(TELAS[nome].chaveIcone, 21)}</span>
      <span class="menu__texto">${TELAS[nome].titulo}</span>
    </a>`).join('');
}

/* ---------- Service worker ---------- */

async function registrarSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    definirRegistroSW(reg);
    await tentarSyncPeriodico();
    // O service worker pede uma verificação quando acorda em segundo plano.
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.tipo === 'verificar-alertas') verificarEDisparar();
    });
  } catch (e) {
    console.warn('Service worker não registrado:', e);
  }
}

/* ---------- Convite para ativar as notificações ---------- */

function talvezPedirNotificacao() {
  const d = obter();
  const temConteudo = d.eventos.length + d.contas.length + d.medicamentos.length > 0;
  if (!temConteudo || permissaoNotificacao() !== 'default') return;
  if (sessionStorage.getItem('convite-notificacao')) return;
  sessionStorage.setItem('convite-notificacao', '1');

  const faixa = document.getElementById('faixa-notificacao');
  faixa.hidden = false;
  faixa.querySelector('[data-ativar]').onclick = async () => {
    const r = await pedirPermissao();
    faixa.hidden = true;
    if (r === 'granted') { await tentarSyncPeriodico(); aviso('Pronto! Você vai ser avisado na hora certa.'); }
  };
  faixa.querySelector('[data-dispensar]').onclick = () => { faixa.hidden = true; };
}

/* ---------- Início ---------- */

async function iniciar() {
  aplicarTema(obter().config.tema);
  aplicarCor(obter().config.matiz);
  observarTemaDoSistema(() => obter().config.tema);
  montarMascote();
  montarMenu();
  desenhar();

  window.addEventListener('hashchange', desenhar);

  // Redesenha a tela sempre que os dados mudarem — e manda para o outro celular.
  inscrever(() => {
    TELAS[telaAtual].render(conteudo);
    atualizarSino();
    sincronizarEmBreve();
  });

  // Chegou coisa do outro celular: só redesenha (não devolve para o servidor).
  window.addEventListener('dados-vieram-da-nuvem', () => {
    TELAS[telaAtual].render(conteudo);
    atualizarSino();
  });

  window.addEventListener('nuvem-sincronizou', atualizarSelo);

  window.addEventListener('alertas-atualizados', atualizarSino);

  // "Sair da conta" devolve o app para a tela de entrada, como faz qualquer
  // outro aplicativo. Antes ele só desligava a sincronização por baixo e
  // continuava aberto, com o nome e os moradores na tela — ninguém percebia
  // que tinha saído de verdade.
  // Sessão vencida ou conta apagada no servidor: em vez de ficar tentando
  // sincronizar para sempre com um selo vermelho, avisa e pede para entrar.
  window.addEventListener('sessao-expirou', (e) => {
    if (!obter().nuvem?.casaId && !usuarioAtual()) return;
    sair({ usuarioId: e.detail?.usuarioId });
    aviso('Sua sessão expirou. Entre de novo para voltar a sincronizar.', 'atencao');
    window.dispatchEvent(new Event('pedir-boas-vindas'));
  });

  window.addEventListener('pedir-boas-vindas', async () => {
    alterar((d) => { d.config.boasVindasFeito = false; });
    await abrirBoasVindas({ reentrada: true });
    desenhar();
    migrarPessoaDaConta();
    iniciarSincronizacaoAutomatica();
    atualizarSelo();
  });

  document.getElementById('sino').onclick = () => { location.hash = '#/inicio'; };
  document.getElementById('botao-config').onclick = () => { location.hash = '#/config'; };

  registrarSW();

  // Primeira abertura: conta, nome e casa antes de entrar no app.
  if (precisaDeBoasVindas()) {
    await abrirBoasVindas();
    desenhar();
  }

  migrarPessoaDaConta();
  iniciarMonitoramento();
  iniciarSincronizacaoAutomatica();
  atualizarSelo();
  relerAgendaSeNecessario();
  setTimeout(talvezPedirNotificacao, 1500);

  // Vira o dia? Redesenha para as datas ficarem certas.
  let diaAnterior = new Date().getDate();
  setInterval(() => {
    const dia = new Date().getDate();
    if (dia !== diaAnterior) { diaAnterior = dia; desenhar(); }
  }, 60000);
}

// Guarda o convite de instalação do Chrome para usar na tela de Ajustes.
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.promptInstalacao = e;
});

iniciar();
