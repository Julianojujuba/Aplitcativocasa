// Sincronização entre os celulares da casa.
// Fala direto com a API do Supabase por fetch — sem biblioteca externa, para o
// app continuar leve e funcionando offline.
import { obter, alterar, salvarSilencioso, aplicarLoteDaNuvem, colecoesSincronizadas,
  garantirPessoa } from './store.js';

// Anotações de controle da sincronização (quando foi a última, até onde já
// enviei) não são conteúdo: se gravassem como mudança normal, o app
// redesenharia a tela inteira a cada 15 segundos — fechando explicações
// abertas e engolindo toques.
function anotar(fn) {
  fn(obter());
  salvarSilencioso();
}

const URL_BASE = 'https://exfucguzruduggqecgwl.supabase.co';
const CHAVE_PUBLICA = 'sb_publishable_o-d2mVMWubxZt_niddNM0g_nMRS0_ES';
const CHAVE_SESSAO = 'casaApp:sessao:v1';

const INTERVALO_SYNC = 15000;   // com o app aberto, verifica a cada 15s
let temporizador = null;
let sincronizando = false;
let pedidoPendente = false;

/* ---------------------------------------------------------------- sessão */

function lerSessao() {
  try { return JSON.parse(localStorage.getItem(CHAVE_SESSAO) || 'null'); }
  catch { return null; }
}

function gravarSessao(s) {
  if (s) localStorage.setItem(CHAVE_SESSAO, JSON.stringify(s));
  else localStorage.removeItem(CHAVE_SESSAO);
}

export function usuarioAtual() {
  return lerSessao()?.user || null;
}

export function estaConectado() {
  return Boolean(lerSessao()?.access_token && obter().nuvem?.casaId);
}

async function tokenValido() {
  const s = lerSessao();
  if (!s?.access_token) return null;
  const faltam = (s.expires_at || 0) * 1000 - Date.now();
  if (faltam > 60000) return s.access_token;

  // Sessão vencendo: renova com o refresh token.
  const r = await fetch(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: CHAVE_PUBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refresh_token })
  });
  // Só desiste quando o servidor diz que a sessão não vale mais. Internet
  // ruim faz o fetch estourar acima daqui, e aí ninguém é deslogado à toa.
  if (!r.ok) {
    const morto = s.user?.id || null;
    gravarSessao(null);
    pararSincronizacaoAutomatica();
    window.dispatchEvent(new CustomEvent('sessao-expirou', { detail: { usuarioId: morto } }));
    return null;
  }
  const nova = await r.json();
  gravarSessao(nova);
  return nova.access_token;
}

async function chamar(caminho, { metodo = 'GET', corpo, cabecalhos = {} } = {}) {
  const token = await tokenValido();
  if (!token) throw new Error('Sua sessão expirou. Entre de novo.');
  const r = await fetch(`${URL_BASE}${caminho}`, {
    method: metodo,
    headers: {
      apikey: CHAVE_PUBLICA,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...cabecalhos
    },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const texto = await r.text();
  const dados = texto ? JSON.parse(texto) : null;
  if (!r.ok) throw new Error(dados?.message || dados?.error_description || `Erro ${r.status}`);
  return dados;
}

/* ---------------------------------------------------------------- entrar e sair */

async function autenticar(caminho, email, senha) {
  const r = await fetch(`${URL_BASE}${caminho}`, {
    method: 'POST',
    headers: { apikey: CHAVE_PUBLICA, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password: senha })
  });
  const dados = await r.json();
  if (!r.ok) {
    const msg = dados?.msg || dados?.error_description || dados?.message || 'Não consegui entrar.';
    throw new Error(traduzir(msg));
  }
  return dados;
}

function traduzir(msg) {
  const m = String(msg).toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha não conferem.';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'Esse e-mail já tem cadastro. Use "Entrar".';
  if (m.includes('password') && m.includes('6')) return 'A senha precisa de pelo menos 6 caracteres.';
  if (m.includes('email') && m.includes('confirm')) return 'Confirme o e-mail antes de entrar.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas seguidas. Espere um pouco.';
  return msg;
}

export async function entrar(email, senha) {
  const s = await autenticar('/auth/v1/token?grant_type=password', email, senha);
  gravarSessao(s);
  // Toda conta tem a sua ficha de pessoa, seja entrando por aqui ou pelas
  // boas-vindas — sem ela o nome deste aparelho não chegaria no outro.
  garantirPessoa(s.user?.id);
  return s.user;
}

// Devolve { precisaConfirmarEmail: true } quando o projeto exige confirmação.
export async function cadastrar(email, senha) {
  const s = await autenticar('/auth/v1/signup', email, senha);
  if (s.access_token) {
    gravarSessao(s);
    garantirPessoa(s.user?.id);
    return { user: s.user };
  }
  return { precisaConfirmarEmail: true };
}

export function sair({ apagarDadosLocais = false, usuarioId } = {}) {
  const meuId = usuarioId ?? usuarioAtual()?.id ?? null;
  gravarSessao(null);
  pararSincronizacaoAutomatica();
  alterar((d) => {
    d.nuvem = { casaId: null, codigo: null, nomeCasa: null, ultimoPushEm: 0, ultimoSyncServidor: null, ultimoErro: null };
    // Saiu da casa: as fichas dos outros moradores não valem mais neste
    // aparelho. Some sem túmulo de propósito — remover de verdade mandaria a
    // exclusão para o celular dela, e sair da conta não apaga nada de ninguém.
    if (meuId) d.pessoas = d.pessoas.filter((p) => !p.dono || p.dono === meuId);
    if (apagarDadosLocais) {
      for (const c of colecoesSincronizadas()) d[c] = [];
      d.tumulos = [];
    }
  });
}

// Chama uma função nossa lá no servidor, já com a identificação da conta.
export async function chamarFuncao(nome, corpo) {
  const token = await tokenValido();
  if (!token) throw new Error('Entre na sua conta para usar isto.');
  const r = await fetch(`${URL_BASE}/functions/v1/${nome}`, {
    method: 'POST',
    headers: {
      apikey: CHAVE_PUBLICA, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'
    },
    body: JSON.stringify(corpo)
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(dados?.erro || `Não deu certo (erro ${r.status}).`);
  return dados;
}

/* ---------------------------------------------------------------- a casa */

export async function criarCasa(nome, apelido) {
  const casa = await chamar('/rest/v1/rpc/criar_casa', {
    metodo: 'POST', corpo: { p_nome: nome, p_apelido: apelido || null }
  });
  guardarCasa(casa);
  return casa;
}

export async function entrarNaCasa(codigo, apelido) {
  const casa = await chamar('/rest/v1/rpc/entrar_na_casa', {
    metodo: 'POST', corpo: { p_codigo: codigo, p_apelido: apelido || null }
  });
  guardarCasa(casa);
  return casa;
}

function guardarCasa(casa) {
  alterar((d) => {
    d.nuvem = {
      ...(d.nuvem || {}),
      casaId: casa.id,
      codigo: casa.codigo_convite,
      nomeCasa: casa.nome,
      ultimoPushEm: 0,            // manda tudo o que já existe neste aparelho
      ultimoSyncServidor: null,   // e busca tudo o que já existe na casa
      ultimoErro: null
    };
  });
}

export async function pessoasDaCasa() {
  const casaId = obter().nuvem?.casaId;
  if (!casaId) return [];
  return chamar(`/rest/v1/membros?casa_id=eq.${casaId}&select=usuario_id,apelido,entrou_em`);
}

/* ---------------------------------------------------------------- sincronizar */

export async function sincronizar({ silencioso = true } = {}) {
  if (!estaConectado()) return { ok: false, motivo: 'desligado' };
  // Pedido feito no meio de outra sincronização fica guardado para logo em
  // seguida: descartar significaria a alteração esperar o ciclo inteiro.
  if (sincronizando) { pedidoPendente = true; return { ok: false, motivo: 'em andamento' }; }
  if (!navigator.onLine) return { ok: false, motivo: 'offline' };

  sincronizando = true;
  const inicio = Date.now();
  try {
    const enviados = await enviarMudancas();
    const recebidos = await buscarMudancas();
    anotar((d) => { d.nuvem.ultimoErro = null; d.nuvem.ultimoSyncEm = Date.now(); });
    window.dispatchEvent(new CustomEvent('nuvem-sincronizou', { detail: { enviados, recebidos } }));
    return { ok: true, enviados, recebidos, ms: Date.now() - inicio };
  } catch (e) {
    console.warn('Falha ao sincronizar:', e);
    anotar((d) => { d.nuvem.ultimoErro = e.message; });
    window.dispatchEvent(new CustomEvent('nuvem-sincronizou', { detail: { erro: e.message } }));
    if (!silencioso) throw e;
    return { ok: false, motivo: e.message };
  } finally {
    sincronizando = false;
    if (pedidoPendente) { pedidoPendente = false; setTimeout(sincronizar, 0); }
  }
}

async function enviarMudancas() {
  const d = obter();
  const { casaId, ultimoPushEm = 0 } = d.nuvem;
  const linhas = [];

  // A marca é de ANTES de juntar e enviar. Se fosse depois, o que a pessoa
  // mexesse enquanto o envio acontece ficaria para trás dessa marca e nunca
  // mais subiria — perda silenciosa de dados.
  const marcaPush = Date.now();

  for (const colecao of colecoesSincronizadas()) {
    for (const item of (d[colecao] || [])) {
      // As fichas de pessoa que o app cria sozinho são rascunho local: se
      // subissem, o "Eu" de um celular apagaria o nome do outro.
      if (colecao === 'pessoas' && !item.dono) continue;
      // Sem carimbo nenhum vale 1, e não 0: com 0 o item empataria com a
      // marca inicial e nunca subiria.
      const quando = item.atualizadoEm || item.criadoEm || 1;
      if (quando <= ultimoPushEm) continue;
      // O carimbo vai junto: é por ele que o servidor decide quem ganha
      // quando os dois celulares mexeram no mesmo item.
      linhas.push({ casa_id: casaId, colecao, id: item.id, dados: item, removido: false, carimbo: quando });
    }
  }
  // Exclusões viajam como marca de removido, senão sumiriam só num aparelho.
  for (const t of (d.tumulos || [])) {
    if (t.em <= ultimoPushEm) continue;
    linhas.push({ casa_id: casaId, colecao: t.colecao, id: t.id, dados: null, removido: true, carimbo: t.em });
  }
  if (!linhas.length) return 0;

  // Em lotes, para não estourar o tamanho da requisição.
  for (let i = 0; i < linhas.length; i += 200) {
    await chamar('/rest/v1/registros', {
      metodo: 'POST',
      corpo: linhas.slice(i, i + 200),
      cabecalhos: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
  }
  anotar((dd) => { dd.nuvem.ultimoPushEm = marcaPush; });
  return linhas.length;
}

async function buscarMudancas() {
  const d = obter();
  const { casaId, ultimoSyncServidor } = d.nuvem;
  const desde = ultimoSyncServidor || '1970-01-01T00:00:00Z';
  let total = 0;
  let marca = ultimoSyncServidor;

  // Página por página, sempre a partir do último instante conhecido.
  for (let volta = 0; volta < 25; volta++) {
    const filtro = `casa_id=eq.${casaId}&atualizado_em=gt.${encodeURIComponent(marca || desde)}`;
    const linhas = await chamar(
      `/rest/v1/registros?${filtro}&select=colecao,id,dados,removido,atualizado_em&order=atualizado_em.asc&limit=500`
    );
    if (!linhas.length) break;
    aplicarLoteDaNuvem(linhas);
    total += linhas.length;
    const anterior = marca;
    marca = linhas[linhas.length - 1].atualizado_em;
    // Se o instante não andou, continuar pediria a mesma página para sempre.
    if (linhas.length < 500 || marca === anterior) break;
  }

  if (marca && marca !== ultimoSyncServidor) {
    anotar((dd) => { dd.nuvem.ultimoSyncServidor = marca; });
  }
  return total;
}

/* ---------------------------------------------------------------- automático */

export function iniciarSincronizacaoAutomatica() {
  pararSincronizacaoAutomatica();
  if (!estaConectado()) return;
  sincronizar();
  temporizador = setInterval(sincronizar, INTERVALO_SYNC);
  document.addEventListener('visibilitychange', aoVoltarParaTela);
  window.addEventListener('online', sincronizar);
}

function aoVoltarParaTela() {
  if (document.visibilityState === 'visible') sincronizar();
}

export function pararSincronizacaoAutomatica() {
  if (temporizador) clearInterval(temporizador);
  temporizador = null;
  document.removeEventListener('visibilitychange', aoVoltarParaTela);
  window.removeEventListener('online', sincronizar);
}

// Depois de mexer em algo, empurra logo — sem esperar o próximo ciclo.
let agendado = null;
export function sincronizarEmBreve() {
  if (!estaConectado()) return;
  clearTimeout(agendado);
  agendado = setTimeout(sincronizar, 1200);
}

export const INFO = { url: URL_BASE };
