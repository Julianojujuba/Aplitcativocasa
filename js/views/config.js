// Ajustes: nomes do casal, tema, notificações, backup e sincronização por arquivo.
import { obter, alterar, atualizar, pessoasVisiveis, salvarSilencioso,
  exportarJSON, importarJSON, apagarTudo } from '../store.js';
import { abrirFormulario, confirmar, aviso } from '../ui.js';
import { esc, hojeISO, fmtData } from '../util.js';
import { permissaoNotificacao, pedirPermissao, notificacaoDeTeste, tentarSyncPeriodico, verificarEDisparar } from '../notify.js';
import { aplicarTema, aplicarCor, PALETAS, matizDoHex, hexDaMatiz, MATIZ_PADRAO } from '../tema.js';
import { atualizarPresenca, reagir } from '../mascote.js';
import { icone } from '../icones.js';
import { LEMBRETES } from './agenda.js';
import {
  estaConectado, usuarioAtual, entrar, cadastrar, sair, criarCasa, entrarNaCasa,
  sincronizar, iniciarSincronizacaoAutomatica
} from '../nuvem.js';
import {
  conectarAoGoogle, listarAgendas, buscarEventos, interpretarICS,
  importarEventos, enderecoDeRetorno, buscarPeloLink, pareceLinkDeAgenda
} from '../googleagenda.js';

export const titulo = 'Ajustes';
export const chaveIcone = 'engrenagem';

// Lembra se o passo a passo do Google estava aberto, para não fechar sozinho.
let ajudaGoogleAberta = false;
let ajudaLinkAberta = false;

// Liga ou desliga os botões que só fazem sentido com o campo preenchido.
function atualizarBotoesDependentes(raiz) {
  const pares = [['#link-agenda', '[data-acao="google-link"]'],
                 ['#google-client', '[data-acao="google-conectar"]']];
  for (const [campoSel, botaoSel] of pares) {
    const campo = raiz.querySelector(campoSel);
    const botao = raiz.querySelector(botaoSel);
    if (campo && botao) botao.disabled = !campo.value.trim();
  }
}

function quandoFoi(ts) {
  if (!ts) return 'ainda não';
  const seg = Math.round((Date.now() - ts) / 1000);
  if (seg < 60) return 'agora mesmo';
  if (seg < 3600) return `há ${Math.round(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.round(seg / 3600)} h`;
  return fmtData(new Date(ts).toISOString().slice(0, 10));
}

function blocoNuvem(d) {
  const usuario = usuarioAtual();
  const casa = d.nuvem || {};

  if (!usuario) {
    return `<section class="painel">
      <div class="painel__topo"><h3>${icone('sincronizar', 17)} Os dois celulares juntos</h3></div>
      <p class="texto-suave">Ligando a sincronização, o que um faz o outro vê: você paga uma conta e
        o aviso some no celular dela; ela põe um item no mercado e ele aparece aqui. Continua de graça.</p>
      <div class="linha-botoes linha-botoes--largo">
        <button class="botao botao--primario" data-acao="nuvem-cadastrar">Criar minha conta</button>
        <button class="botao botao--suave" data-acao="nuvem-entrar">Já tenho conta</button>
      </div>
      <small class="campo__dica">Sem a sincronização o app funciona normal — só que cada celular
        com seus próprios dados.</small>
    </section>`;
  }

  if (!casa.casaId) {
    return `<section class="painel">
      <div class="painel__topo"><h3>${icone('sincronizar', 17)} Os dois celulares juntos</h3>
        <span class="etiqueta etiqueta--atencao">Falta a casa</span></div>
      <p class="texto-suave">Você entrou como <strong>${esc(usuario.email)}</strong>.
        Agora: se você é o primeiro dos dois, crie a casa e passe o código para ela.
        Se ela já criou, use o código dela.</p>
      <div class="linha-botoes linha-botoes--largo">
        <button class="botao botao--primario" data-acao="nuvem-criar-casa">Criar a nossa casa</button>
        <button class="botao botao--suave" data-acao="nuvem-entrar-casa">Tenho um código</button>
      </div>
      <button class="botao botao--suave botao--largo" data-acao="nuvem-sair">Sair da conta</button>
    </section>`;
  }

  return `<section class="painel">
    <div class="painel__topo"><h3>${icone('sincronizar', 17)} Os dois celulares juntos</h3>
      <span class="etiqueta etiqueta--${casa.ultimoErro ? 'perigo' : 'ok'}">
        ${casa.ultimoErro ? 'Com problema' : 'Ligado'}</span></div>

    <p class="texto-suave">Tudo que vocês fazem aqui aparece no outro celular em alguns segundos.</p>

    <div class="codigo-casa">
      <div>
        <small class="campo__dica">Código da casa</small>
        <strong>${esc(casa.codigo || '')}</strong>
      </div>
      <button class="botao botao--suave botao--pequeno" data-acao="nuvem-copiar">Copiar</button>
    </div>
    <small class="campo__dica">Esse é o código que a outra pessoa usa em
      "Tenho um código" no celular dela. Não passe para mais ninguém.</small>

    <div class="linha-info"><span>Conta</span><strong>${esc(usuario.email)}</strong></div>
    <div class="linha-info"><span>Última sincronização</span><strong>${quandoFoi(casa.ultimoSyncEm)}</strong></div>
    ${casa.ultimoErro ? `<div class="linha-info"><span>Último erro</span>
      <strong class="texto-perigo">${esc(casa.ultimoErro)}</strong></div>` : ''}

    <div class="linha-botoes linha-botoes--largo">
      <button class="botao botao--primario" data-acao="nuvem-sincronizar">Sincronizar agora</button>
    </div>
    <button class="botao botao--perigo-suave botao--largo" data-acao="nuvem-sair">Sair da conta</button>
  </section>`;
}

/* ---------------------------------------------------------------- ações da nuvem */

async function formularioConta(modo) {
  const v = await abrirFormulario({
    titulo: modo === 'entrar' ? 'Entrar na conta' : 'Criar conta',
    campos: [
      { nome: 'email', rotulo: 'E-mail', tipo: 'texto', obrigatorio: true, placeholder: 'voce@email.com' },
      { nome: 'senha', rotulo: 'Senha', tipo: 'texto', obrigatorio: true,
        dica: modo === 'entrar' ? '' : 'Pelo menos 6 caracteres' }
    ],
    textoOk: modo === 'entrar' ? 'Entrar' : 'Criar',
    aoValidar: (v) => {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return 'Confira o e-mail.';
      if (modo !== 'entrar' && v.senha.length < 6) return 'A senha precisa de pelo menos 6 caracteres.';
      return null;
    }
  });
  return v;
}

async function acaoConta(modo, raiz) {
  const v = await formularioConta(modo);
  if (!v) return;
  try {
    if (modo === 'entrar') {
      await entrar(v.email, v.senha);
      aviso('Conta conectada.');
    } else {
      const r = await cadastrar(v.email, v.senha);
      if (r.precisaConfirmarEmail) {
        aviso('Enviei um e-mail de confirmação. Confirme e depois use "Já tenho conta".', 'atencao');
        return;
      }
      aviso('Conta criada.');
    }
    iniciarSincronizacaoAutomatica();
    render(raiz);
  } catch (e) {
    aviso(e.message, 'erro');
  }
}

async function acaoCriarCasa(raiz) {
  const v = await abrirFormulario({
    titulo: 'Criar a nossa casa',
    campos: [
      { nome: 'nome', rotulo: 'Nome da casa', tipo: 'texto', placeholder: 'Ex.: Casa do Juliano' },
      { nome: 'apelido', rotulo: 'Como você se chama aqui', tipo: 'texto', placeholder: 'Seu nome' }
    ],
    valores: { nome: 'Nossa Casa' },
    textoOk: 'Criar'
  });
  if (!v) return;
  try {
    const casa = await criarCasa(v.nome, v.apelido);
    iniciarSincronizacaoAutomatica();
    await sincronizar();
    render(raiz);
    aviso(`Casa criada! O código é ${casa.codigo_convite}.`);
  } catch (e) {
    aviso(e.message, 'erro');
  }
}

async function acaoEntrarCasa(raiz) {
  const v = await abrirFormulario({
    titulo: 'Entrar na casa',
    campos: [
      { nome: 'codigo', rotulo: 'Código da casa', tipo: 'texto', obrigatorio: true, placeholder: 'ABCD2345' },
      { nome: 'apelido', rotulo: 'Como você se chama aqui', tipo: 'texto', placeholder: 'Seu nome' }
    ],
    textoOk: 'Entrar'
  });
  if (!v) return;
  try {
    await entrarNaCasa(v.codigo, v.apelido);
    iniciarSincronizacaoAutomatica();
    await sincronizar();
    render(raiz);
    aviso('Pronto! Os dois celulares agora mostram a mesma coisa.');
  } catch (e) {
    aviso(e.message, 'erro');
  }
}

function blocoGoogle(d) {
  const clientId = d.config.googleClientId || '';
  const link = d.config.linkAgendaGoogle || '';
  const ultima = d.config.ultimaImportacaoGoogle;
  return `<section class="painel">
    <div class="painel__topo"><h3>${icone('agenda', 17)} Trazer a agenda que vocês já usam</h3></div>
    <p class="texto-suave">Do iPhone ou do Google, para não redigitar o que já está marcado.</p>

    <div class="campo">
      <label class="campo__rotulo" for="link-agenda">Link da sua agenda</label>
      <input id="link-agenda" type="url" class="entrada" data-config-valor="linkAgendaGoogle"
        value="${esc(link)}" placeholder="Cole aqui o link da agenda"
        autocomplete="off" spellcheck="false">
      <small class="campo__dica">Cola uma vez e pronto: dá para reler quando quiser,
        e o app relê sozinho uma vez por dia.</small>
    </div>
    <button class="botao botao--primario botao--largo" data-acao="google-link"
      ${link ? '' : 'disabled'}>Importar agenda agora</button>
    ${link ? '' : '<small class="campo__dica">Cole o link acima para liberar este botão.</small>'}

    <details class="ajuda" id="ajuda-link" ${ajudaLinkAberta ? 'open' : ''}>
      <summary>Onde acho esse link</summary>

      <p class="texto-suave"><strong>No iPhone</strong> — dá para fazer no próprio celular:</p>
      <ol class="lista-passos">
        <li>Abra o app <strong>Calendário</strong>.</li>
        <li>Toque em <strong>Calendários</strong>, embaixo no meio.</li>
        <li>Toque no <strong>ⓘ</strong> ao lado da agenda que você quer trazer.</li>
        <li>Ligue <strong>Calendário Público</strong>.</li>
        <li>Toque em <strong>Compartilhar Link</strong> → <strong>Copiar</strong>.</li>
        <li>Volte aqui e cole no campo acima.</li>
      </ol>

      <p class="texto-suave"><strong>No Google Agenda</strong> — precisa da versão para computador:</p>
      <ol class="lista-passos">
        <li>Abra <strong>calendar.google.com</strong>.</li>
        <li>No menu da esquerda, na sua agenda: <strong>⋮</strong> →
          <strong>Configurações e compartilhamento</strong>.</li>
        <li>Role até <strong>Endereço secreto no formato iCal</strong> e copie.</li>
      </ol>

      <div class="alerta">
        <strong class="alerta__titulo">${icone('aviso', 15)} Sobre esse link</strong>
        <span>Ele é a chave da sua agenda: quem tiver o endereço consegue ver os
          compromissos dela. Não repasse. Para cortar o acesso depois, é só desligar
          o compartilhamento no iPhone, ou gerar outro endereço no Google.</span>
      </div>
    </details>

    <div class="linha-info"><span>Outros jeitos</span></div>
    <button class="botao botao--suave botao--largo" data-acao="google-ics">Importar arquivo .ics</button>
    <small class="campo__dica">Se você já tem o arquivo da agenda salvo no aparelho.</small>

    <details class="ajuda" id="ajuda-google" ${ajudaGoogleAberta ? 'open' : ''}>
      <summary>Conectar direto na conta (mais trabalhoso)</summary>
      <p class="texto-suave">Exige criar uma credencial no Google Cloud. Só vale a pena
        se o link secreto não servir para você.</p>
      <div class="campo">
        <label class="campo__rotulo" for="google-client">ID do cliente do Google</label>
        <input id="google-client" type="text" class="entrada" data-config-valor="googleClientId"
          value="${esc(clientId)}" placeholder="000000-abc.apps.googleusercontent.com">
      </div>
      <button class="botao botao--suave botao--largo" data-acao="google-conectar"
        ${clientId ? '' : 'disabled'}>Conectar e importar</button>
      <ol class="lista-passos">
        <li>Abra <strong>console.cloud.google.com</strong> e crie um projeto.</li>
        <li>Ative a <strong>Google Calendar API</strong>.</li>
        <li>Na tela de permissão OAuth, escolha "Externo" e adicione os e-mails de vocês
          em "Usuários de teste".</li>
        <li>Crie um <strong>ID do cliente OAuth</strong> do tipo Aplicativo da Web.</li>
        <li>Origens autorizadas:<br><code>${esc(location.origin)}</code></li>
        <li>URIs de redirecionamento:<br><code>${esc(enderecoDeRetorno())}</code></li>
      </ol>
    </details>

    ${ultima ? `<div class="linha-info"><span>Última importação</span>
      <strong>${esc(ultima)}</strong></div>` : ''}
  </section>`;
}

async function importarPeloLink(raiz, { silencioso = false } = {}) {
  // O que vale é o que está escrito no campo agora: esperar o "salvar ao sair
  // do campo" travava o botão para quem colava o link e tocava em seguida.
  const campo = raiz.querySelector('#link-agenda');
  const link = (campo?.value ?? obter().config.linkAgendaGoogle ?? '').trim();
  if (!pareceLinkDeAgenda(link)) {
    if (!silencioso) aviso('Esse link não parece o endereço de uma agenda do iPhone nem do Google.', 'erro');
    return;
  }
  // Guarda só depois de conferir, para não salvar um endereço torto.
  if (link !== obter().config.linkAgendaGoogle) {
    alterar((dd) => { dd.config.linkAgendaGoogle = link; });
  }
  try {
    if (!silencioso) aviso('Buscando na sua agenda…');
    const lista = await buscarPeloLink(link);
    const r = importarEventos(lista);
    alterar((dd) => {
      dd.config.ultimaImportacaoGoogle = fmtData(hojeISO());
      dd.config.ultimaLeituraLinkEm = Date.now();
    });
    if (!silencioso) {
      aviso(`${r.novos} novos, ${r.atualizados} atualizados, ${r.ignorados} já estavam iguais.`);
      render(raiz);
    }
  } catch (e) {
    if (!silencioso) aviso(e.message, 'erro');
  }
}

async function importarDoGoogle(raiz) {
  const d = obter();
  const clientId = (d.config.googleClientId || '').trim();
  if (!clientId) { aviso('Preencha o ID do cliente do Google primeiro.', 'atencao'); return; }
  try {
    aviso('Abrindo a janela do Google…');
    const token = await conectarAoGoogle(clientId);
    const agendas = await listarAgendas(token);
    if (!agendas.length) { aviso('Não encontrei nenhuma agenda sua.', 'atencao'); return; }

    let escolhidas = agendas;
    if (agendas.length > 1) {
      const v = await abrirFormulario({
        titulo: 'De qual agenda?',
        campos: [{ nome: 'agenda', rotulo: 'Agenda', tipo: 'selecao',
          opcoes: [{ valor: '*', texto: 'Todas' },
                   ...agendas.map((a) => ({ valor: a.id, texto: a.nome }))] }],
        valores: { agenda: '*' },
        textoOk: 'Importar'
      });
      if (!v) return;
      if (v.agenda !== '*') escolhidas = agendas.filter((a) => a.id === v.agenda);
    }

    const todos = [];
    for (const a of escolhidas) todos.push(...await buscarEventos(token, a.id));
    const r = importarEventos(todos);
    alterar((dd) => { dd.config.ultimaImportacaoGoogle = fmtData(hojeISO()); });
    aviso(`${r.novos} novos, ${r.atualizados} atualizados, ${r.ignorados} já estavam iguais.`);
    render(raiz);
  } catch (e) {
    aviso(e.message, 'erro');
  }
}

function importarICS(raiz) {
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = '.ics,text/calendar';
  entrada.onchange = async () => {
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    try {
      const lista = interpretarICS(await arquivo.text());
      if (!lista.length) { aviso('Não achei compromissos nesse arquivo.', 'atencao'); return; }
      const r = importarEventos(lista);
      alterar((dd) => { dd.config.ultimaImportacaoGoogle = fmtData(hojeISO()); });
      aviso(`${r.novos} novos, ${r.atualizados} atualizados, ${r.ignorados} já estavam iguais.`);
      render(raiz);
    } catch (e) {
      aviso('Não consegui ler esse arquivo .ics.', 'erro');
    }
  };
  entrada.click();
}

async function editarPessoa(id) {
  const d = obter();
  const p = d.pessoas.find((x) => x.id === id);
  if (!p) return;
  const v = await abrirFormulario({
    titulo: 'Editar pessoa',
    campos: [
      { nome: 'nome', rotulo: 'Nome', tipo: 'texto', obrigatorio: true },
      { nome: 'cor', rotulo: 'Cor', tipo: 'selecao', opcoes: [
        { valor: '#6366f1', texto: 'Azul' }, { valor: '#ec4899', texto: 'Rosa' },
        { valor: '#10b981', texto: 'Verde' }, { valor: '#f59e0b', texto: 'Laranja' },
        { valor: '#8b5cf6', texto: 'Roxo' }, { valor: '#06b6d4', texto: 'Ciano' }
      ] }
    ],
    valores: p
  });
  if (!v) return;
  // Passa por atualizar() e não por alterar() direto: é ele que carimba o
  // atualizadoEm, sem o qual a troca de nome nunca chegaria no outro celular.
  atualizar('pessoas', id, v);
  aviso('Nome atualizado.');
}

function baixarBackup() {
  const conteudo = exportarJSON();
  const blob = new Blob([conteudo], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `casa-backup-${hojeISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  aviso('Backup baixado. Guarde o arquivo em local seguro.');
}

async function compartilharBackup() {
  const conteudo = exportarJSON();
  const arquivo = new File([conteudo], `casa-backup-${hojeISO()}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Backup do app da casa' });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  baixarBackup();
}

function importarArquivo(mesclar) {
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = 'application/json,.json';
  entrada.onchange = async () => {
    const arquivo = entrada.files?.[0];
    if (!arquivo) return;
    try {
      const texto = await arquivo.text();
      importarJSON(texto, { mesclar });
      aviso(mesclar ? 'Dados juntados com sucesso.' : 'Backup restaurado.');
      aplicarTema(obter().config.tema);
    } catch (e) {
      aviso('Não consegui ler esse arquivo. Ele é um backup do app?', 'erro');
    }
  };
  entrada.click();
}

function estatisticas() {
  const d = obter();
  return [
    ['Compromissos', d.eventos.length],
    ['Remédios', d.medicamentos.length],
    ['Itens na lista', d.mercado.length],
    ['Contas', d.contas.length],
    ['Movimentos', d.transacoes.length],
    ['Compras', d.compras.length]
  ];
}

const TEXTO_PERMISSAO = {
  granted: ['Ativadas', 'ok'],
  denied: ['Bloqueadas pelo navegador', 'perigo'],
  default: ['Ainda não autorizadas', 'atencao'],
  indisponivel: ['Não suportado neste navegador', 'neutro']
};

export function render(raiz) {
  const d = obter();
  const permissao = permissaoNotificacao();
  const [textoPerm, corPerm] = TEXTO_PERMISSAO[permissao] || TEXTO_PERMISSAO.default;
  const instalado = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

  raiz.innerHTML = `
    ${blocoNuvem(d)}

    <section class="painel">
      <div class="painel__topo"><h3>${icone('pessoas', 17)} Quem mora aqui</h3></div>
      ${pessoasVisiveis().map((p) => `
        <article class="item item--compacto">
          <span class="avatar" style="background:${esc(p.cor)}">${esc(p.nome[0] || '?')}</span>
          <div class="item__conteudo" data-pessoa="${p.id}">
            <div class="item__linha1"><strong>${esc(p.nome)}</strong></div>
            <div class="item__linha2"><span class="item__meta">Toque para trocar o nome</span></div>
          </div>
        </article>`).join('')}
    </section>

    <section class="painel">
      <div class="painel__topo"><h3>${icone('sino', 17)} Notificações</h3>
        <span class="etiqueta etiqueta--${corPerm}">${textoPerm}</span></div>
      <p class="texto-suave">Os avisos são gerados no próprio aparelho — não passam por nenhum servidor.</p>

      ${permissao !== 'granted' ? `
        <button class="botao botao--primario botao--largo" data-acao="permitir">Ativar notificações</button>
        ${permissao === 'denied' ? `<small class="alerta-texto">
          Você bloqueou os avisos. Para liberar: toque no cadeado ao lado do endereço do site →
          Permissões → Notificações → Permitir.</small>` : ''}
      ` : `
        <div class="campo campo--switch">
          <label class="switch"><input type="checkbox" data-config="notificacoes" ${d.config.notificacoes ? 'checked' : ''}>
            <span class="switch__pista"></span></label>
          <div><span class="campo__rotulo">Avisos automáticos</span>
            <small class="campo__dica">Compromissos, remédios e contas vencendo</small></div>
        </div>
        <div class="campo campo--switch">
          <label class="switch"><input type="checkbox" data-config="resumoDiario" ${d.config.resumoDiario ? 'checked' : ''}>
            <span class="switch__pista"></span></label>
          <div><span class="campo__rotulo">Resumo da manhã</span>
            <small class="campo__dica">Um aviso por dia com tudo que está marcado</small></div>
        </div>
        <div class="campo campo--metade">
          <label class="campo__rotulo" for="hora-resumo">Hora do resumo</label>
          <input id="hora-resumo" type="time" class="entrada" data-config-valor="horaResumoDiario"
            value="${esc(d.config.horaResumoDiario || '08:00')}">
        </div>
        <div class="campo">
          <label class="campo__rotulo" for="lembrete-padrao">Avisar compromissos com antecedência de</label>
          <select id="lembrete-padrao" class="entrada" data-config-valor="lembretePadraoMin">
            ${LEMBRETES.map((l) => `<option value="${l.valor}"
              ${String(d.config.lembretePadraoMin ?? 60) === l.valor ? 'selected' : ''}>${esc(l.texto)}</option>`).join('')}
          </select>
          <small class="campo__dica">Vale para os próximos compromissos; cada um pode ter o seu.</small>
        </div>
        <div class="campo campo--metade">
          <label class="campo__rotulo" for="dias-aviso">Avisar contas com antecedência de</label>
          <input id="dias-aviso" type="number" min="0" max="15" class="entrada" data-config-valor="diasAvisoConta"
            value="${Number(d.config.diasAvisoConta) || 3}">
          <small class="campo__dica">dias</small>
        </div>
        <button class="botao botao--suave botao--largo" data-acao="testar">Enviar aviso de teste</button>
      `}
    </section>

    ${blocoGoogle(d)}

    <section class="painel">
      <div class="painel__topo"><h3>${icone('paleta', 17)} Aparência</h3></div>

      <div class="campo">
        <span class="campo__rotulo">Claro ou escuro</span>
        <div class="opcoes-tema">
          ${[['escuro', 'Reator'], ['claro', 'Claro'], ['auto', 'Sistema']].map(([v, t]) => `
            <button class="opcao-tema ${d.config.tema === v ? 'is-ativa' : ''}" data-escolher-tema="${v}">${t}</button>`).join('')}
        </div>
      </div>

      <div class="campo">
        <span class="campo__rotulo">Cor do app</span>
        <div class="paletas">
          ${PALETAS.map((pa) => `
            <button class="paleta ${Number(d.config.matiz) === pa.matiz ? 'is-ativa' : ''}"
              style="--tom:${pa.matiz}" data-matiz="${pa.matiz}"
              title="${esc(pa.nome)}" aria-label="Cor ${esc(pa.nome)}"></button>`).join('')}
          <span class="paleta paleta--livre" title="Escolher qualquer cor">
            <input type="color" id="cor-livre" value="${esc(hexDaMatiz(d.config.matiz ?? MATIZ_PADRAO))}"
              aria-label="Escolher qualquer cor">
          </span>
        </div>
        <small class="campo__dica">Cada celular tem a sua — a sua cor não muda a dela.</small>
      </div>

      <div class="campo campo--switch">
        <label class="switch"><input type="checkbox" data-config="mascote" ${d.config.mascote !== false ? 'checked' : ''}>
          <span class="switch__pista"></span></label>
        <div><span class="campo__rotulo">Ajudante da casa</span>
          <small class="campo__dica">O robozinho no canto que comemora junto</small></div>
      </div>
    </section>

    <section class="painel">
      <div class="painel__topo"><h3>${icone('sincronizar', 17)} Backup e sincronização</h3></div>
      <p class="texto-suave">Uma cópia de segurança em arquivo, para guardar fora do celular.
        <strong>Isto não é sincronização</strong> — é uma foto do momento, feita na mão.
        Para os dois celulares andarem juntos sozinhos, use a sincronização lá em cima.</p>
      <div class="linha-botoes linha-botoes--largo">
        <button class="botao botao--primario" data-acao="compartilhar">Enviar backup</button>
        <button class="botao botao--suave" data-acao="baixar">Baixar arquivo</button>
      </div>
      <div class="linha-botoes linha-botoes--largo">
        <button class="botao botao--suave" data-acao="importar-juntar">Juntar backup</button>
        <button class="botao botao--suave" data-acao="importar-substituir">Restaurar backup</button>
      </div>
      <small class="campo__dica">"Juntar" mantém o que já existe aqui e adiciona o que vier do arquivo.
        "Restaurar" apaga tudo daqui e coloca o conteúdo do arquivo no lugar.</small>
    </section>

    <section class="painel">
      <div class="painel__topo"><h3>${icone('celular', 17)} Instalar no celular</h3></div>
      ${instalado
        ? '<p class="texto-suave">✓ O app já está instalado neste aparelho.</p>'
        : `<p class="texto-suave">Instale para abrir como um aplicativo de verdade, funcionar sem internet
             e receber os avisos.</p>
           <ul class="lista-passos">
             <li><strong>Android (Chrome):</strong> menu ⋮ → "Instalar aplicativo" / "Adicionar à tela inicial"</li>
             <li><strong>iPhone (Safari):</strong> botão compartilhar → "Adicionar à Tela de Início"</li>
           </ul>
           <button class="botao botao--primario botao--largo" data-acao="instalar" hidden>Instalar agora</button>`}
    </section>

    <section class="painel">
      <div class="painel__topo"><h3>${icone('caixa', 17)} O que já tem aqui</h3></div>
      <div class="estatisticas">
        ${estatisticas().map(([rotulo, n]) => `
          <div class="estatistica"><strong>${n}</strong><span>${esc(rotulo)}</span></div>`).join('')}
      </div>
      <small class="campo__dica">Em uso desde ${fmtData(d.config.criadoEm || hojeISO())}</small>
    </section>

    <section class="painel painel--perigo">
      <div class="painel__topo"><h3>${icone('aviso', 17)} Zona de risco</h3></div>
      <p class="texto-suave">Isso apaga tudo deste aparelho e não tem como desfazer. Faça um backup antes.</p>
      <button class="botao botao--perigo botao--largo" data-acao="apagar">Apagar todos os dados</button>
    </section>

    <p class="rodape-app">Feito para a nossa casa · Funciona offline · Sem custo, sem servidor, sem anúncio</p>`;

  // Botão de instalar do Chrome, quando o navegador oferece.
  const botaoInstalar = raiz.querySelector('[data-acao="instalar"]');
  if (botaoInstalar && window.promptInstalacao) botaoInstalar.hidden = false;

  raiz.querySelector('#ajuda-google')?.addEventListener('toggle', (e) => {
    ajudaGoogleAberta = e.target.open;
  });
  raiz.querySelector('#ajuda-link')?.addEventListener('toggle', (e) => {
    ajudaLinkAberta = e.target.open;
  });

  // Os botões que dependem de um campo preenchido acompanham a digitação,
  // sem gravar nada (gravar redesenharia a tela e tiraria o cursor do campo).
  for (const campo of raiz.querySelectorAll('#link-agenda, #google-client')) {
    campo.addEventListener('input', () => atualizarBotoesDependentes(raiz));
  }

  raiz.onchange = (e) => {
    const seletorCor = e.target.closest('#cor-livre');
    if (seletorCor) {
      const matiz = matizDoHex(seletorCor.value);
      alterar((dados) => { dados.config.matiz = matiz; });
      aplicarCor(matiz);
      return;
    }

    const alvo = e.target.closest('[data-config]');
    if (alvo) {
      alterar((dados) => { dados.config[alvo.dataset.config] = alvo.checked; });
      if (alvo.dataset.config === 'mascote') {
        atualizarPresenca();
        if (alvo.checked) setTimeout(() => reagir('ocioso'), 350);
      } else if (alvo.checked) {
        verificarEDisparar();
      }
      return;
    }
    const valor = e.target.closest('[data-config-valor]');
    if (valor) {
      const chave = valor.dataset.configValor;
      // Grava sem redesenhar: sair de um campo tocando num botão disparava
      // este evento, a tela era reconstruída e o toque caía no botão antigo.
      obter().config[chave] = ['diasAvisoConta', 'lembretePadraoMin'].includes(chave)
        ? Number(valor.value) : valor.value;
      salvarSilencioso();
      atualizarBotoesDependentes(raiz);
      aviso('Ajuste salvo.');
    }
  };

  raiz.onclick = async (e) => {
    const p = e.target.closest('[data-pessoa]');
    if (p) { editarPessoa(p.dataset.pessoa); return; }

    const cor = e.target.closest('[data-matiz]');
    if (cor) {
      const matiz = Number(cor.dataset.matiz);
      alterar((dados) => { dados.config.matiz = matiz; });
      aplicarCor(matiz);
      return;
    }

    const t = e.target.closest('[data-escolher-tema]');
    if (t) {
      alterar((dados) => { dados.config.tema = t.dataset.escolherTema; });
      aplicarTema(t.dataset.escolherTema);
      return;
    }

    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (!acao) return;

    if (acao === 'google-link') { importarPeloLink(raiz); return; }
    if (acao === 'google-ics') { importarICS(raiz); return; }
    if (acao === 'google-conectar') { importarDoGoogle(raiz); return; }
    if (acao === 'nuvem-entrar') { acaoConta('entrar', raiz); return; }
    if (acao === 'nuvem-cadastrar') { acaoConta('cadastrar', raiz); return; }
    if (acao === 'nuvem-criar-casa') { acaoCriarCasa(raiz); return; }
    if (acao === 'nuvem-entrar-casa') { acaoEntrarCasa(raiz); return; }
    if (acao === 'nuvem-copiar') {
      const codigo = obter().nuvem?.codigo || '';
      try {
        await navigator.clipboard.writeText(codigo);
        aviso('Código copiado. Mande para ela.');
      } catch {
        aviso(`O código é ${codigo}`);
      }
      return;
    }
    if (acao === 'nuvem-sincronizar') {
      try {
        const r = await sincronizar({ silencioso: false });
        aviso(r.ok ? `Tudo em dia (${r.enviados} enviados, ${r.recebidos} recebidos).`
                   : 'Não consegui agora. Confira a internet.', r.ok ? 'ok' : 'atencao');
      } catch (e) {
        aviso(e.message, 'erro');
      }
      render(raiz);
      return;
    }
    if (acao === 'nuvem-sair') {
      const ok = await confirmar({
        titulo: 'Sair da conta',
        mensagem: 'O app volta para a tela de entrada e este celular para de sincronizar com o outro. Nada é apagado: seus dados continuam aqui e no celular dela. Você pode entrar de novo quando quiser.',
        textoOk: 'Sair', perigo: true
      });
      // Quem cuida de voltar para a tela de entrada é o app.js — pedir por
      // evento evita config.js e app.js ficarem importando um ao outro.
      if (ok) { sair(); window.dispatchEvent(new Event('pedir-boas-vindas')); }
      return;
    }

    if (acao === 'permitir') {
      const r = await pedirPermissao();
      if (r === 'granted') {
        await tentarSyncPeriodico();
        await notificacaoDeTeste();
        aviso('Notificações ativadas!');
      } else if (r === 'denied') {
        aviso('O navegador bloqueou os avisos. Libere nas permissões do site.', 'erro');
      }
      render(raiz);
    } else if (acao === 'testar') {
      const ok = await notificacaoDeTeste();
      if (!ok) aviso('Não consegui enviar. Confira as permissões do navegador.', 'erro');
    } else if (acao === 'compartilhar') {
      compartilharBackup();
    } else if (acao === 'baixar') {
      baixarBackup();
    } else if (acao === 'importar-juntar') {
      importarArquivo(true);
    } else if (acao === 'importar-substituir') {
      const ok = await confirmar({
        titulo: 'Restaurar backup',
        mensagem: 'Isso apaga os dados atuais deste aparelho e coloca os do arquivo no lugar. Continuar?',
        textoOk: 'Restaurar', perigo: true
      });
      if (ok) importarArquivo(false);
    } else if (acao === 'instalar') {
      window.promptInstalacao?.prompt();
    } else if (acao === 'apagar') {
      const ok = await confirmar({
        titulo: 'Apagar tudo',
        mensagem: 'Todos os compromissos, contas, remédios e lançamentos serão apagados deste aparelho. Tem certeza?',
        textoOk: 'Apagar tudo', perigo: true
      });
      if (ok) {
        apagarTudo();
        aviso('Tudo apagado. O app está zerado.');
        render(raiz);
      }
    }
  };
}
