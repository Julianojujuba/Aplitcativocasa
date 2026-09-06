// Ajustes: nomes do casal, tema, notificações, backup e sincronização por arquivo.
import { obter, alterar, atualizar, exportarJSON, importarJSON, apagarTudo } from '../store.js';
import { abrirFormulario, confirmar, aviso } from '../ui.js';
import { esc, hojeISO, fmtData } from '../util.js';
import { permissaoNotificacao, pedirPermissao, notificacaoDeTeste, tentarSyncPeriodico, verificarEDisparar } from '../notify.js';
import { aplicarTema, aplicarCor, PALETAS, matizDoHex, hexDaMatiz, MATIZ_PADRAO } from '../tema.js';
import { atualizarPresenca, reagir } from '../mascote.js';
import { icone } from '../icones.js';
import {
  estaConectado, usuarioAtual, entrar, cadastrar, sair, criarCasa, entrarNaCasa,
  sincronizar, iniciarSincronizacaoAutomatica
} from '../nuvem.js';
import {
  conectarAoGoogle, listarAgendas, buscarEventos, interpretarICS,
  importarEventos, enderecoDeRetorno
} from '../googleagenda.js';

export const titulo = 'Ajustes';
export const chaveIcone = 'engrenagem';

// Lembra se o passo a passo do Google estava aberto, para não fechar sozinho.
let ajudaGoogleAberta = false;

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
      <button class="botao botao--suave" data-acao="nuvem-sair">Desligar</button>
    </div>
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
  const ultima = d.config.ultimaImportacaoGoogle;
  return `<section class="painel">
    <div class="painel__topo"><h3>${icone('agenda', 17)} Trazer a agenda do Google</h3></div>
    <p class="texto-suave">Para não precisar redigitar o que já está marcado lá.</p>

    <div class="linha-info"><span>Jeito rápido, sem configurar nada</span></div>
    <button class="botao botao--primario botao--largo" data-acao="google-ics">Importar arquivo .ics</button>
    <small class="campo__dica">No computador, abra o Google Agenda → Configurações →
      "Importar e exportar" → Exportar. Vem um .zip; descompacte e escolha aqui o arquivo .ics.</small>

    <div class="linha-info"><span>Conectado na conta (traz sempre que você pedir)</span></div>
    <div class="campo">
      <label class="campo__rotulo" for="google-client">ID do cliente do Google</label>
      <input id="google-client" type="text" class="entrada" data-config-valor="googleClientId"
        value="${esc(clientId)}" placeholder="000000-abc.apps.googleusercontent.com">
    </div>
    <button class="botao botao--suave botao--largo" data-acao="google-conectar"
      ${clientId ? '' : 'disabled'}>Conectar e importar do Google</button>
    ${clientId ? '' : '<small class="campo__dica">Preencha o ID acima para liberar este botão.</small>'}

    <details class="ajuda" id="ajuda-google" ${ajudaGoogleAberta ? 'open' : ''}>
      <summary>Como conseguir esse ID (uma vez só, de graça)</summary>
      <ol class="lista-passos">
        <li>Abra <strong>console.cloud.google.com</strong> e crie um projeto.</li>
        <li>Em <strong>APIs e serviços → Biblioteca</strong>, ative a <strong>Google Calendar API</strong>.</li>
        <li>Em <strong>Tela de permissão OAuth</strong>, escolha "Externo", preencha o nome e,
          em "Usuários de teste", adicione o e-mail seu e o dela.</li>
        <li>Em <strong>Credenciais → Criar credenciais → ID do cliente OAuth</strong>,
          tipo <strong>Aplicativo da Web</strong>.</li>
        <li>Em "Origens JavaScript autorizadas", coloque:<br><code>${esc(location.origin)}</code></li>
        <li>Em "URIs de redirecionamento autorizados", coloque:<br><code>${esc(enderecoDeRetorno())}</code></li>
        <li>Copie o ID gerado e cole no campo acima.</li>
      </ol>
      <small class="campo__dica">Como o app fica em "teste", o Google mostra um aviso de
        app não verificado. É esperado: basta seguir em "Avançado". Só vocês dois têm acesso.</small>
    </details>

    ${ultima ? `<div class="linha-info"><span>Última importação</span>
      <strong>${esc(ultima)}</strong></div>` : ''}
  </section>`;
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
      ${d.pessoas.map((p) => `
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
      alterar((dados) => {
        dados.config[chave] = chave === 'diasAvisoConta' ? Number(valor.value) : valor.value;
      });
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
        titulo: 'Desligar a sincronização',
        mensagem: 'Este celular para de conversar com o outro. Os dados continuam aqui e no outro aparelho — nada é apagado. Continuar?',
        textoOk: 'Desligar'
      });
      if (ok) { sair(); aviso('Sincronização desligada.'); render(raiz); }
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
