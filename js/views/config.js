// Ajustes: nomes do casal, tema, notificações, backup e sincronização por arquivo.
import { obter, alterar, exportarJSON, importarJSON, apagarTudo } from '../store.js';
import { abrirFormulario, confirmar, aviso } from '../ui.js';
import { esc, hojeISO, fmtData } from '../util.js';
import { permissaoNotificacao, pedirPermissao, notificacaoDeTeste, tentarSyncPeriodico, verificarEDisparar } from '../notify.js';
import { aplicarTema } from '../tema.js';
import { icone } from '../icones.js';

export const titulo = 'Ajustes';
export const chaveIcone = 'engrenagem';

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
  alterar((dados) => {
    const i = dados.pessoas.findIndex((x) => x.id === id);
    if (i >= 0) dados.pessoas[i] = { ...dados.pessoas[i], ...v };
  });
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

    <section class="painel">
      <div class="painel__topo"><h3>${icone('paleta', 17)} Aparência</h3></div>
      <div class="opcoes-tema">
        ${[['escuro', 'Reator'], ['claro', 'Claro'], ['auto', 'Sistema']].map(([v, t]) => `
          <button class="opcao-tema ${d.config.tema === v ? 'is-ativa' : ''}" data-escolher-tema="${v}">${t}</button>`).join('')}
      </div>
    </section>

    <section class="painel">
      <div class="painel__topo"><h3>${icone('sincronizar', 17)} Backup e sincronização</h3></div>
      <p class="texto-suave">Tudo fica salvo só no seu aparelho. Para passar os dados para o celular
        da sua esposa (ou para não perder nada), exporte o arquivo e importe no outro aparelho.</p>
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

  raiz.onchange = (e) => {
    const alvo = e.target.closest('[data-config]');
    if (alvo) {
      alterar((dados) => { dados.config[alvo.dataset.config] = alvo.checked; });
      if (alvo.checked) verificarEDisparar();
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

    const t = e.target.closest('[data-escolher-tema]');
    if (t) {
      alterar((dados) => { dados.config.tema = t.dataset.escolherTema; });
      aplicarTema(t.dataset.escolherTema);
      return;
    }

    const acao = e.target.closest('[data-acao]')?.dataset.acao;
    if (!acao) return;

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
