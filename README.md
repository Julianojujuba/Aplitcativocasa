# Nossa Casa

Aplicativo pessoal para organizar a casa de um casal: agenda, farmácia, lista de
mercado, contas a pagar e painel financeiro — tudo num lugar só.

**Custo zero. Sem servidor, sem mensalidade, sem anúncio, sem cadastro.**
Os dados ficam guardados no próprio celular.

---

## O que ele faz

| Tela | Para que serve |
|---|---|
| **Início** | O resumo do dia: o que precisa de atenção, quanto entrou e saiu no mês, compromissos de hoje, doses de remédio, contas vencendo e a lista de mercado. |
| **Agenda** | Compromissos com hora, local, responsável, lembrete e repetição (diária, semanal, quinzenal, mensal, anual). Ao concluir um item que se repete, o próximo já é criado. |
| **Farmácia** | Remédios com horários das doses, dias da semana, período do tratamento e controle de estoque. Marcar a dose baixa o estoque; quando fica baixo, o app avisa. Repor pode lançar a despesa direto no financeiro. |
| **Mercado** | Lista de compras com entrada rápida (digita e aperta Enter), categorias, preço estimado e itens que vocês compram sempre. Ao finalizar a compra, ela entra no histórico e vira despesa no financeiro. |
| **Contas** | Contas fixas (todo mês) e avulsas, com dia de vencimento, categoria, responsável e baixa de pagamento. Mostra total do mês, quanto já foi pago, quanto falta e o que está atrasado. |
| **Financeiro** | Salários e outras rendas, gastos avulsos, evolução dos últimos 6 meses, gasto por categoria e limite de gasto por categoria. |
| **Ajustes** | Nomes de vocês dois, notificações, tema, backup e instalação. |

---

## Como colocar no ar de graça (GitHub Pages)

O app é feito só de arquivos estáticos, então o GitHub hospeda sem cobrar nada.

1. Acesse este repositório no GitHub.
2. Vá em **Settings** (Configurações) → **Pages**, no menu da esquerda.
3. Em **Source**, escolha **Deploy from a branch**.
4. Em **Branch**, escolha a branch onde está o código e a pasta `/ (root)`.
5. Clique em **Save** e espere um ou dois minutos.
6. O GitHub mostra o endereço, algo como:
   `https://julianojujuba.github.io/aplitcativocasa/`

Guarde esse endereço — é por ele que vocês dois vão abrir o app.

> O endereço é público (qualquer um que souber o link vê o *aplicativo*), mas
> **os dados de vocês não vão para lugar nenhum**: ficam só no celular de cada um.

---

## Primeira abertura

Na primeira vez, o app conduz a configuração em passos curtos: criar a conta
(ou entrar numa existente), escolher **como você quer ser chamado** e a sua
cor, criar a casa ou entrar com o código dela, e ativar os avisos. Depois
disso ele abre direto no painel.

Quem preferir só experimentar pode escolher **"Usar só neste celular por
enquanto"** e ligar a sincronização depois, nos Ajustes.

---

## Como instalar no celular

Abra o endereço no navegador do celular e instale como aplicativo:

- **Android (Chrome):** menu **⋮** → **Instalar aplicativo** (ou *Adicionar à tela inicial*).
- **iPhone (Safari):** botão **Compartilhar** → **Adicionar à Tela de Início**.

Depois de instalado ele abre em tela cheia, com ícone próprio, e **funciona sem
internet** — a conexão só é necessária na primeira abertura.

---

## Notificações

Na primeira vez, toque em **Ativar** quando o app perguntar (ou vá em
**Ajustes → Notificações → Ativar notificações**).

O app avisa sobre:

- compromissos da agenda, no tempo de antecedência que você escolher;
- hora de cada dose de remédio;
- estoque de remédio acabando;
- contas chegando (padrão: 3 dias antes), vencendo hoje e atrasadas;
- dia em que o salário cai;
- um resumo pela manhã, no horário que você definir.

**Sendo honesto sobre o limite:** os avisos são gerados pelo próprio aparelho,
sem servidor de notificação (é isso que mantém o custo em zero). Na prática:

- No **Android**, com o app instalado, os avisos chegam normalmente, inclusive
  com o app fechado — o sistema acorda o app de tempos em tempos.
- No **iPhone**, é preciso **iOS 16.4 ou mais novo** e o app **instalado na tela
  de início**. Os avisos são mais espaçados que no Android.
- Em qualquer aparelho, abrir o app põe tudo em dia na hora.

Se quiser aviso garantido no minuto exato mesmo com o celular parado há dias,
seria preciso um serviço de envio (com custo ou conta em algum provedor). Do
jeito que está, é grátis para sempre.

---

## Vocês dois no mesmo app

Ligando a sincronização, os dois celulares mostram exatamente a mesma coisa:
você paga uma conta e o aviso some no celular dela; ela põe um item na lista e
ele aparece aqui. Continua sem custo (Supabase, plano gratuito).

**No primeiro celular:**

1. **Ajustes → Criar minha conta** (e-mail e uma senha de pelo menos 6 letras).
2. **Criar a nossa casa.**
3. Aparece um **código de 8 letras**. Copie e mande para a outra pessoa.

**No segundo celular:**

1. **Ajustes → Criar minha conta** (com o e-mail *dela*, senha própria).
2. **Tenho um código** → digite o código da casa.

Pronto. Daí em diante o app atualiza sozinho: a cada 15 segundos com o app
aberto, ao voltar para a tela e assim que a internet volta. Se mexer sem
internet, fica guardado e sobe quando reconectar.

O código da casa é a chave: **não passe para mais ninguém.**

### Ainda existe o backup em arquivo

**Ajustes → Baixar arquivo** continua ali, mas é outra coisa: uma cópia de
segurança feita na mão, uma foto do momento. Serve para guardar fora do
celular ou levar os dados para um aparelho novo. Não é ele que mantém os dois
celulares em dia — isso é a sincronização.

---

## Deixar com a sua cara

Em **Ajustes → Aparência**:

- **Claro ou escuro** — Reator (escuro, o padrão), Claro ou acompanhar o sistema.
- **Cor do app** — sete cores prontas (ciano, azul, lilás, rosa, rubi, âmbar,
  menta) ou qualquer outra pelo seletor do celular. A escolha repinta tudo:
  botões, bordas, brilhos, gráficos, ícones e até o robozinho.
- **Ajudante da casa** — o robô no canto que comemora junto quando você anota
  um compromisso, toma o remédio ou paga uma conta. Pode desligar.

**Cada celular tem a sua aparência.** Essas preferências não são
sincronizadas: você pode deixar o seu num tom e ela no dela, olhando os mesmos
dados. O que sincroniza é o conteúdo da casa, não o visual.

---

## Trazer a agenda do Google

Para não redigitar o que já está marcado lá. Dois caminhos, em
**Ajustes → Trazer a agenda do Google**:

**Sem configurar nada — arquivo .ics**
No computador: Google Agenda → Configurações → "Importar e exportar" →
Exportar. Baixa um .zip; descompacte e escolha o .ics no app. Ele entende
compromissos de dia inteiro, com hora, com fuso e os que se repetem.

**Conectado na conta**
Traz os compromissos direto, sempre que você pedir. Exige criar uma
credencial gratuita no Google uma única vez — o passo a passo está dentro do
próprio app, em "Como conseguir esse ID".

Importar duas vezes não duplica nada: o que já existe é atualizado.

---

## Privacidade

**Com a sincronização desligada**, nada sai do aparelho: os dados ficam no
`localStorage` do navegador e não existe servidor nenhum.

**Com a sincronização ligada**, os dados da casa ficam num projeto Supabase
que é **seu**, com uma regra no banco que só deixa cada casa enxergar as
próprias informações. Ninguém além de quem tem o código da casa alcança nada.
Não há analytics, rastreamento nem anúncio em lugar nenhum.

A conexão com o Google Agenda é somente leitura e acontece direto entre o seu
navegador e o Google — nenhuma senha passa pelo app.

---

## Para mexer no código

Não precisa instalar nada nem compilar: é HTML, CSS e JavaScript puro
(módulos ES nativos).

```bash
# rodar localmente
python3 -m http.server 8000
# depois abra http://localhost:8000
```

> Abrir o `index.html` direto pelo arquivo (`file://`) não funciona: os módulos
> e o service worker exigem `http://` ou `https://`.

### Organização

```
index.html               casca do app (cabeçalho, menu, área de conteúdo)
manifest.webmanifest     dados de instalação do app no celular
sw.js                    service worker: funcionamento offline e cliques nas notificações
css/styles.css           todo o visual; a paleta inteira nasce da variável --matiz
assets/icons/            ícones do app
js/
  app.js                 navegação entre telas e inicialização
  store.js               dados: leitura, gravação, backup, migração
  financas.js            contas do mês: previsto, realizado, categorias, histórico
  notify.js              cálculo dos alertas e disparo das notificações
  nuvem.js               sincronização entre os celulares (Supabase, por fetch)
  googleagenda.js        importação do Google Agenda (conta ou arquivo .ics)
  ui.js                  modal, formulários, avisos, gráfico, blocos reaproveitados
  icones.js              ícones em SVG
  mascote.js             o ajudante que reage às ações
  tema.js                tema claro/escuro e cor de destaque
  views/                 uma tela por arquivo (boasvindas.js é a primeira abertura)
oauth.html               página de passagem da autorização do Google
```

### Como a sincronização funciona

No banco existe uma tabela só, `registros`, com `(casa_id, colecao, id)` e o
item inteiro em JSON — assim um campo novo no app não pede migração. Cada
linha carrega `atualizado_em`, carimbado pelo banco com `clock_timestamp()`
(com `now()` um lote inteiro sairia com o mesmo instante e a busca paginada
pularia registros).

O aparelho manda o que mudou desde o último envio e busca o que passou a
existir depois do último instante que ele conhece. Exclusões viajam como marca
de removido — sem isso, apagar num celular não apagaria no outro. Quando dois
mexem no mesmo item, vale o mais recente.

### Como os dados são guardados

Uma única chave no `localStorage` (`casaApp:dados:v1`) com um objeto contendo
`eventos`, `medicamentos`, `doses`, `mercado`, `compras`, `contas`, `pagamentos`,
`rendas`, `recebimentos`, `transacoes`, `orcamentos`, `pessoas` e `config`.

Contas fixas não são copiadas mês a mês: cada conta existe uma vez, e o mês em
que ela aparece é calculado. O que fica gravado é o **pagamento** daquele mês.
Mesma ideia para as rendas e seus recebimentos. Assim mudar o valor de uma conta
não reescreve o histórico.
