// Primeira abertura do app: conta, nome, casa e avisos, em passos curtos.
// Só aparece uma vez; depois disso o app abre direto no painel.
import { obter, alterar, atualizar } from '../store.js';
import { aviso } from '../ui.js';
import { esc } from '../util.js';
import { icone } from '../icones.js';
import { cadastrar, entrar, criarCasa, entrarNaCasa, sincronizar,
  iniciarSincronizacaoAutomatica } from '../nuvem.js';
import { PALETAS, aplicarCor } from '../tema.js';
import { pedirPermissao, permissaoNotificacao, tentarSyncPeriodico } from '../notify.js';

const CORES_PESSOA = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export function precisaDeBoasVindas() {
  return obter().config?.boasVindasFeito !== true;
}

export function abrirBoasVindas() {
  return new Promise((resolve) => {
    const tela = document.createElement('div');
    tela.className = 'boas-vindas-tela';
    document.body.appendChild(tela);
    document.body.classList.add('sem-rolagem');

    // O que a pessoa foi respondendo pelo caminho.
    const dados = { temConta: false, nome: '', matiz: 189, casaPronta: false, codigo: null,
                    aguardandoEmail: null };
    let passo = 0;

    const encerrar = () => {
      alterar((d) => { d.config.boasVindasFeito = true; });
      tela.remove();
      document.body.classList.remove('sem-rolagem');
      resolve(dados);
    };

    const irPara = (n) => { passo = n; desenhar(); };

    function desenhar() {
      tela.innerHTML = `
        <div class="bv">
          <div class="bv__topo">
            <span class="bv__marca">${icone('casa', 30)}</span>
            <div class="bv__pontos">
              ${[0, 1, 2, 3, 4].map((i) => `<i class="${i === passo ? 'is-atual' : (i < passo ? 'is-feito' : '')}"></i>`).join('')}
            </div>
          </div>
          <div class="bv__corpo">${PASSOS[passo]()}</div>
        </div>`;
      LIGAR[passo]?.();
      // Só campos de texto ganham o foco; focar um botão deixa um anel
      // estranho na tela de quem está usando o dedo.
      tela.querySelector('input[type="text"], input[type="email"]')?.focus?.({ preventScroll: true });
    }

    /* ------------------------------------------------ 0: boas-vindas */
    const PASSOS = [];
    const LIGAR = [];

    PASSOS[0] = () => `
      <h1 class="bv__titulo">Nossa Casa</h1>
      <p class="bv__texto">Agenda, remédios, mercado e as contas da casa num lugar só —
        e igual nos dois celulares.</p>
      <ul class="bv__lista">
        <li>${icone('agenda', 17)}<span>Compromissos com lembrete na hora certa</span></li>
        <li>${icone('pilula', 17)}<span>Remédios, horários e estoque</span></li>
        <li>${icone('cartao', 17)}<span>Contas a pagar, sem esquecer nenhuma</span></li>
        <li>${icone('grafico', 17)}<span>Quanto entrou, quanto saiu, quanto sobrou</span></li>
      </ul>
      <button class="botao botao--primario botao--largo" data-ir="1">Começar</button>`;

    LIGAR[0] = () => {
      tela.querySelector('[data-ir="1"]').onclick = () => irPara(1);
    };

    /* ------------------------------------------------ 1: conta */
    PASSOS[1] = () => dados.aguardandoEmail ? `
      <h2 class="bv__titulo bv__titulo--menor">Confirme seu e-mail</h2>
      <p class="bv__texto">Mandei uma mensagem para
        <strong>${esc(dados.aguardandoEmail)}</strong>. Abra e toque no link de confirmação.</p>
      <div class="alerta">
        <strong class="alerta__titulo">${icone('aviso', 15)} O link vai abrir uma página com erro</strong>
        <span>Ela diz "não é possível acessar esse site". Pode ignorar: sua conta
          já foi confirmada no momento em que você tocou no link.</span>
      </div>
      <button class="botao botao--primario botao--largo" data-ja-confirmei>Já confirmei — entrar</button>
      <button class="bv__pular" data-outro-email>Usar outro e-mail</button>
    ` : `
      <h2 class="bv__titulo bv__titulo--menor">Sua conta</h2>
      <p class="bv__texto">É ela que deixa os dois celulares mostrando a mesma coisa.
        Você paga uma conta e o aviso some no celular dela.</p>
      <form class="bv__form" id="bv-conta" novalidate>
        <label class="campo__rotulo" for="bv-email">E-mail</label>
        <input id="bv-email" class="entrada" type="email" inputmode="email"
          autocomplete="email" placeholder="voce@email.com">
        <label class="campo__rotulo" for="bv-senha">Senha</label>
        <input id="bv-senha" class="entrada" type="password" autocomplete="new-password"
          placeholder="pelo menos 6 caracteres">
        <div class="linha-botoes linha-botoes--largo">
          <button type="submit" class="botao botao--primario" data-modo="criar">Criar conta</button>
          <button type="button" class="botao botao--suave" data-modo="entrar">Já tenho conta</button>
        </div>
      </form>
      <button class="bv__pular" data-pular>Usar só neste celular por enquanto</button>`;

    LIGAR[1] = () => {
      if (dados.aguardandoEmail) {
        tela.querySelector('[data-ja-confirmei]').onclick = async (ev) => {
          ev.target.disabled = true;
          try {
            await entrar(dados.aguardandoEmail, dados.senhaTentada);
            dados.temConta = true;
            dados.aguardandoEmail = null;
            irPara(2);
          } catch (err) {
            aviso(/confirm/i.test(err.message)
              ? 'Ainda não constou como confirmado. Abra o link do e-mail e tente de novo.'
              : err.message, 'erro');
            ev.target.disabled = false;
          }
        };
        tela.querySelector('[data-outro-email]').onclick = () => {
          dados.aguardandoEmail = null;
          desenhar();
        };
        return;
      }

      const form = tela.querySelector('#bv-conta');
      const tentar = async (modo) => {
        const email = tela.querySelector('#bv-email').value.trim();
        const senha = tela.querySelector('#bv-senha').value;
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { aviso('Confira o e-mail.', 'erro'); return; }
        if (senha.length < 6) { aviso('A senha precisa de pelo menos 6 caracteres.', 'erro'); return; }
        const botoes = tela.querySelectorAll('.bv__form button');
        botoes.forEach((b) => { b.disabled = true; });
        try {
          if (modo === 'criar') {
            const r = await cadastrar(email, senha);
            if (r.precisaConfirmarEmail) {
              dados.aguardandoEmail = email;
              dados.senhaTentada = senha;
              desenhar();
              return;
            }
          } else {
            await entrar(email, senha);
          }
          dados.temConta = true;
          irPara(2);
        } catch (e) {
          aviso(e.message, 'erro');
        } finally {
          botoes.forEach((b) => { b.disabled = false; });
        }
      };
      form.onsubmit = (e) => { e.preventDefault(); tentar('criar'); };
      tela.querySelector('[data-modo="entrar"]').onclick = () => tentar('entrar');
      tela.querySelector('[data-pular]').onclick = () => irPara(2);
    };

    /* ------------------------------------------------ 2: nome e cor */
    PASSOS[2] = () => `
      <h2 class="bv__titulo bv__titulo--menor">Como você quer ser chamado?</h2>
      <p class="bv__texto">É assim que o app vai te cumprimentar todo dia.</p>
      <form class="bv__form" id="bv-nome" novalidate>
        <input id="bv-apelido" class="entrada entrada--grande" type="text"
          autocomplete="given-name" placeholder="Seu nome" maxlength="24" value="${esc(dados.nome)}">
        <label class="campo__rotulo">Sua cor</label>
        <div class="paletas">
          ${PALETAS.map((pa) => `
            <button type="button" class="paleta ${dados.matiz === pa.matiz ? 'is-ativa' : ''}"
              style="--tom:${pa.matiz}" data-matiz="${pa.matiz}" aria-label="${esc(pa.nome)}"></button>`).join('')}
        </div>
        <small class="campo__dica">Vale só para este celular — ela pode escolher outra no dela.</small>
        <button type="submit" class="botao botao--primario botao--largo">Continuar</button>
      </form>`;

    LIGAR[2] = () => {
      const campoNome = tela.querySelector('#bv-apelido');
      // Guarda o que já foi digitado: sem isto, mexer na cor apagaria o nome.
      campoNome.oninput = () => { dados.nome = campoNome.value; };

      tela.querySelectorAll('[data-matiz]').forEach((b) => {
        b.onclick = () => {
          dados.matiz = Number(b.dataset.matiz);
          alterar((d) => { d.config.matiz = dados.matiz; });
          aplicarCor(dados.matiz);
          // Troca só o destaque do círculo escolhido, sem redesenhar o passo.
          tela.querySelectorAll('[data-matiz]').forEach((outro) => {
            outro.classList.toggle('is-ativa', outro === b);
          });
        };
      });

      tela.querySelector('#bv-nome').onsubmit = (e) => {
        e.preventDefault();
        const nome = campoNome.value.trim();
        if (!nome) { aviso('Me diz como te chamar.', 'atencao'); return; }
        dados.nome = nome;
        irPara(dados.temConta ? 3 : 4);
      };
    };

    /* ------------------------------------------------ 3: a casa */
    PASSOS[3] = () => dados.casaPronta ? `
      <h2 class="bv__titulo bv__titulo--menor">Casa criada!</h2>
      <p class="bv__texto">Passe este código para ela. No celular dela, em
        "Tenho um código", é só digitar.</p>
      <div class="codigo-casa codigo-casa--grande">
        <strong>${esc(dados.codigo || '')}</strong>
      </div>
      <button class="botao botao--suave botao--largo" data-copiar>Copiar código</button>
      <button class="botao botao--primario botao--largo" data-ir="4">Continuar</button>
    ` : `
      <h2 class="bv__titulo bv__titulo--menor">A casa de vocês</h2>
      <p class="bv__texto">Se você é o primeiro dos dois, crie a casa e passe o código para ela.
        Se ela já criou, use o código dela.</p>
      <div class="linha-botoes linha-botoes--largo">
        <button class="botao botao--primario" data-criar-casa>Criar a nossa casa</button>
      </div>
      <form class="bv__form" id="bv-codigo" novalidate>
        <label class="campo__rotulo" for="bv-cod">Ou entre com o código dela</label>
        <input id="bv-cod" class="entrada entrada--codigo" type="text" maxlength="9"
          placeholder="ABCD2345" autocapitalize="characters" autocomplete="off">
        <button type="submit" class="botao botao--suave botao--largo">Entrar na casa</button>
      </form>`;

    LIGAR[3] = () => {
      const salvarPessoa = (id) => {
        alterar((d) => { d.config.pessoaId = id; });
        atualizar('pessoas', id, { nome: dados.nome, cor: CORES_PESSOA[id === 'p_1' ? 0 : 1] });
      };

      if (dados.casaPronta) {
        tela.querySelector('[data-copiar]').onclick = async () => {
          try { await navigator.clipboard.writeText(dados.codigo); aviso('Código copiado.'); }
          catch { aviso(`O código é ${dados.codigo}`); }
        };
        tela.querySelector('[data-ir="4"]').onclick = () => irPara(4);
        return;
      }

      tela.querySelector('[data-criar-casa]').onclick = async (e) => {
        e.target.disabled = true;
        try {
          const casa = await criarCasa('Nossa Casa', dados.nome);
          salvarPessoa('p_1');
          iniciarSincronizacaoAutomatica();
          await sincronizar();
          dados.casaPronta = true;
          dados.codigo = casa.codigo_convite;
          desenhar();
        } catch (err) {
          aviso(err.message, 'erro');
          e.target.disabled = false;
        }
      };

      tela.querySelector('#bv-codigo').onsubmit = async (ev) => {
        ev.preventDefault();
        const codigo = tela.querySelector('#bv-cod').value.trim();
        if (!codigo) { aviso('Digite o código da casa.', 'atencao'); return; }
        try {
          await entrarNaCasa(codigo, dados.nome);
          salvarPessoa('p_2');
          iniciarSincronizacaoAutomatica();
          await sincronizar();
          aviso('Pronto! Os dois celulares agora mostram a mesma coisa.');
          irPara(4);
        } catch (err) {
          aviso(err.message, 'erro');
        }
      };
    };

    /* ------------------------------------------------ 4: avisos */
    PASSOS[4] = () => {
      const p = permissaoNotificacao();
      if (p === 'granted') {
        return `
          <h2 class="bv__titulo bv__titulo--menor">Tudo pronto${dados.nome ? `, ${esc(dados.nome)}` : ''}!</h2>
          <p class="bv__texto">Os avisos já estão ativos. Bom proveito.</p>
          <button class="botao botao--primario botao--largo" data-fim>Entrar no app</button>`;
      }
      return `
        <h2 class="bv__titulo bv__titulo--menor">Posso te avisar?</h2>
        <p class="bv__texto">Aviso da conta antes de vencer, da hora do remédio e do
          compromisso que está chegando. Sem isso o app não lembra você de nada.</p>
        <button class="botao botao--primario botao--largo" data-permitir>Ativar avisos</button>
        <button class="bv__pular" data-fim>Agora não</button>`;
    };

    LIGAR[4] = () => {
      const permitir = tela.querySelector('[data-permitir]');
      if (permitir) {
        permitir.onclick = async () => {
          const r = await pedirPermissao();
          if (r === 'granted') await tentarSyncPeriodico();
          else if (r === 'denied') aviso('O navegador bloqueou. Dá para liberar depois nos Ajustes.', 'atencao');
          desenhar();
        };
      }
      tela.querySelector('[data-fim]').onclick = () => {
        if (dados.nome && !dados.temConta) {
          // Sem conta não há casa; ainda assim o nome vale neste aparelho.
          alterar((d) => { d.config.pessoaId = 'p_1'; });
          atualizar('pessoas', 'p_1', { nome: dados.nome });
        }
        encerrar();
      };
    };

    desenhar();
  });
}
