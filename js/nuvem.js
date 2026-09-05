// Sincronização entre os celulares da casa.
// Fala direto com a API do Supabase por fetch — sem biblioteca externa, para o
// app continuar leve e funcionando offline.
import { obter, alterar, salvarSilencioso, aplicarLoteDaNuvem, colecoesSincronizadas } from './store.js';

const URL_BASE = 'https://exfucguzruduggqecgwl.supabase.co';
const CHAVE_PUBLICA = 'sb_publishable_o-d2mVMWubxZt_niddNM0g_nMRS0_ES';
const CHAVE_SESSAO = 'casaApp:sessao:v1';

const INTERVALO_SYNC = 15000;   // com o app aberto, verifica a cada 15s
let temporizador = null;
let sincronizando = false;

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
  if (!r.ok) { gravarSessao(null); return null; }
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
  return s.user;
}

// Devolve { precisaConfirmarEmail: true } quando o projeto exige confirmação.
export async function cadastrar(email, senha) {
  const s = await autenticar('/auth/v1/signup', email, senha);
  if (s.access_token) { gravarSessao(s); return { user: s.user }; }
  return { precisaConfirmarEmail: true };
}

export function sair({ apagarDadosLocais = false } = {}) {
  gravarSessao(null);
  pararSincronizacaoAutomatica();
  alterar((d) => {
    d.nuvem = { casaId: null, codigo: null, nomeCasa: null, ultimoPushEm: 0, ultimoSyncServidor: null, ultimoErro: null };
    if (apagarDadosLocais) {
      for (const c of colecoesSincronizadas()) d[c] = [];
      d.tumulos = [];
    }
  });
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
  if (sincronizando || !estaConectado()) return { ok: false, motivo: 'desligado' };
  if (!navigator.onLine) return { ok: false, motivo: 'offline' };

  sincronizando = true;
  const inicio = Date.now();
  try {
    const enviados = await enviarMudancas();
    const recebidos = await buscarMudancas();
    alterar((d) => { d.nuvem.ultimoErro = null; d.nuvem.ultimoSyncEm = Date.now(); });
    window.dispatchEvent(new CustomEvent('nuvem-sincronizou', { detail: { enviados, recebidos } }));
    return { ok: true, enviados, recebidos, ms: Date.now() - inicio };
  } catch (e) {
    console.warn('Falha ao sincronizar:', e);
    alterar((d) => { d.nuvem.ultimoErro = e.message; });
    if (!silencioso) throw e;
    return { ok: false, motivo: e.message };
  } finally {
    sincronizando = false;
  }
}

async function enviarMudancas() {
  const d = obter();
  const { casaId, ultimoPushEm = 0 } = d.nuvem;
  const linhas = [];

  for (const colecao of colecoesSincronizadas()) {
    for (const item of (d[colecao] || [])) {
      if ((item.atualizadoEm || item.criadoEm || 0) <= ultimoPushEm) continue;
      linhas.push({ casa_id: casaId, colecao, id: item.id, dados: item, removido: false });
    }
  }
  // Exclusões viajam como marca de removido, senão sumiriam só num aparelho.
  for (const t of (d.tumulos || [])) {
    if (t.em <= ultimoPushEm) continue;
    linhas.push({ casa_id: casaId, colecao: t.colecao, id: t.id, dados: null, removido: true });
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
  alterar((dd) => { dd.nuvem.ultimoPushEm = Date.now(); });
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
    alterar((dd) => { dd.nuvem.ultimoSyncServidor = marca; });
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
