# rotik-panel-agents

**Painel de Monitoramento de Agentes de IA** · Desafio Técnico Fullstack · Rotik

MVP que permite ver, por cliente, quais agentes de IA estão ativos, quanto cada um consumiu da cota
mensal do plano contratado, e bloquear novas execuções quando o limite é atingido.

**Stack:** Node.js + TypeScript (backend) · React + TypeScript (frontend) · PostgreSQL
**Deploy:** _(link na Etapa 6)_

<details>
<summary><b>Por que essa stack</b></summary>

O desafio dá liberdade e cita Nuxt/Laravel como referência. Escolhi React + Node/TS, que também está
na stack da Rotik, por dois motivos: é onde produzo com mais densidade no tempo sugerido, e manter
TypeScript nas duas pontas permite compartilhar os tipos do contrato da API sem geração de código.

PostgreSQL, e não MongoDB, porque o problema central aqui é **cota transacional**. A regra de negócio
depende de verificar um limite e incrementar um contador de forma atômica, que é o caso clássico de
transação ACID em linha única.
</details>

## Status

Construído **por etapas**, seguindo o enunciado. Cada etapa é revisada antes da seguinte começar, e é
por isso que o histórico de commits é granular.

| Etapa | Entrega | Status |
|---|---|---|
| **0** | **Discovery** | ✅ |
| 1 | Modelagem de dados | ⏳ Próxima |
| 2 | Backend REST API | ⏳ |
| 3 | Frontend (SPA) | ⏳ |
| 4 | Integração | ⏳ |
| 5 | Qualidade, testes e debug | ⏳ |
| 6 | DevOps (CI, deploy, env) | ⏳ |
| 7 | Mentalidade de produto | ⏳ |

**Convenção de commits:** [Conventional Commits 1.0.0](https://www.conventionalcommits.org/pt-br/v1.0.0/),
no formato `<tipo>(<escopo>): <descrição no imperativo>`.

## Índice

- [Etapa 0: Discovery](#etapa-0-discovery)
  - [Perguntas e suposições](#1-perguntas-que-eu-faria-ao-stakeholder)
  - [Entidades de negócio](#2-entidades-de-negócio)
  - [Escopo do MVP](#3-escopo-do-mvp)
  - [Riscos que decidi não resolver agora](#4-riscos-que-decidi-não-resolver-agora)

---

# Etapa 0: Discovery

O briefing tem uma frase que decide o projeto inteiro:

> "Quando o cliente estourar o limite, o agente deveria parar de responder **(ou pelo menos a gente
> precisa saber que isso aconteceu)**."

Esse parêntese não é detalhe de redação. É o time de Produto admitindo que não sabe se está pedindo um
**mecanismo de enforcement** ou um **painel de observabilidade**. São produtos diferentes, com donos,
riscos e custos diferentes. Quase todas as perguntas abaixo saem dessa dúvida, e boa parte do meu
Discovery foi decidir como não apostar tudo em uma das duas leituras.

## 1. Perguntas que eu faria ao stakeholder

São seis, e o mínimo pedido é cinco. Todas estão aqui porque a resposta mudaria código. Para cada uma
anoto também o custo de ter errado, porque é isso que decide quanto vale discutir antes de construir e
quanto vale apenas seguir com confiança.

### 1. O limite é do cliente ou de cada agente?

O briefing diz as duas coisas. "Cada **plano** tem um limite mensal" e "quando o **cliente** estourar o
limite" apontam para o cliente. Já "quantas execuções cada **agente** fez" aponta para o agente.

**Assumi que a cota é do cliente e a atribuição é do agente.** O plano é contratado pelo cliente, então
o limite é um pool compartilhado entre os agentes dele e o bloqueio olha o contador do cliente. Junto
disso mantenho um contador por agente, porque quando o CS vê uma conta em 95% a primeira pergunta nunca
é "quanto o cliente usou", e sim "qual agente está queimando isso".

<details>
<summary>Como isso concilia as duas leituras, e o custo se eu errei</summary>

O dashboard mostra a cota do cliente, que é a que bloqueia, e dentro de cada agente quanto aquele
agente consumiu do mesmo limite. Um agente em 60/100 ao lado de outro em 22/100 é lido na hora como
"o primeiro é o problema".

Se o limite for mesmo por agente, bastaria movê-lo para o agente ou criar uma tabela de override. O
contador por agente já existe no modelo, então a migração seria aditiva e o enforcement mudaria de
linha. **Custo baixo, e isso foi de propósito.**
</details>

### 2. Quem usa o painel: o CS da Rotik ou o cliente final?

De novo, o briefing diz os dois. "Fácil de usar pelo nosso time de CS" sugere ferramenta interna, mas a
Etapa 2 pede que "um cliente não pode ver dados de outro", que é self-service.

**Assumi tenant-scoped:** a autenticação é por cliente, o token carrega o identificador dele, e toda
query é filtrada por ele. O painel de CS vem depois, como um papel `admin` capaz de assumir a visão de
um tenant.

<details>
<summary>Por que nessa ordem, e o custo se eu errei</summary>

Isolamento é a decisão irreversível. Construir tenant-scoped e depois abrir para um admin é aditivo,
basta um claim de papel no token. Construir aberto e depois tentar apertar o isolamento é uma auditoria
de vazamento em cada endpoint. Quando não dá para perguntar, escolho o caminho que erra para o lado
seguro.

Se eu errei, o CS precisa trocar de login para ver cada conta. Chato, mas o painel funciona.
**Custo baixo.** O erro inverso teria sido vazamento de dados entre clientes.
</details>

### 3. A Rotik executa o agente, ou só registra que ele executou?

Essa é o parêntese do briefing traduzido em pergunta técnica. Se a Rotik está no caminho da requisição,
a recusa deste serviço **é** o "parar de responder". Se ela só recebe logs depois, bloquear aqui não
para nada, é só um carimbo, e o produto real passa a ser o alerta.

**Assumi que a Rotik executa.** A própria descrição diz "plataforma que permite criar, configurar e
monitorar agentes", e quem configura, executa. Logo este serviço é o sistema de registro da cota: o
runtime registra a execução antes de responder ao usuário final, e uma recusa faz o agente parar.

<details>
<summary>A consequência que assumo junto, e o custo se eu errei</summary>

Esse endpoint entra no caminho crítico de latência de **todo** atendimento da Rotik. É por isso que
trato performance de leitura como requisito da Etapa 1, e não como otimização prematura.

Se eu errei, a recusa vira sinalização e as execuções bloqueadas viram o produto. O código não muda, o
que muda é o que o consumidor faz com a resposta. **Custo baixo**, e é exatamente por isso que **registro
a execução bloqueada mesmo bloqueando**. Uma tentativa recusada e gravada atende às duas leituras do
parêntese ao mesmo tempo, sem me obrigar a escolher uma.
</details>

### 4. O que conta como uma execução?

Isso é semântica de faturamento. Se erro conta, o cliente paga por falha da Rotik. Se não conta, um
agente quebrado vira compute infinito de graça.

| Situação | Consome cota? | Por quê |
|---|---|---|
| Sucesso | **Sim** | Óbvio. |
| Erro (ex.: timeout do LLM) | **Sim** | O custo de inferência já foi pago pela Rotik. Não cobrar transforma agente instável em prejuízo. |
| **Bloqueada** por limite | **Não** | Nunca chegou a rodar. Cobrar por uma recusa seria indefensável, e criaria o absurdo de a cota estourada se auto-alimentar. |
| Retry | **Sim**, cada tentativa | O modelo não distingue retry de chamada nova. |

<details>
<summary>O custo se eu errei</summary>

Mudar para "erro não conta" é uma linha de código, mas **corrige o histórico para trás com
dificuldade**, porque competências já fechadas ficariam inconsistentes. **Custo médio**, e é a suposição
desta lista que eu mais gostaria de confirmar antes de faturar em cima dela.
</details>

### 5. "Mensal" é mês calendário ou ciclo da assinatura?

Um cliente que assinou dia 22 espera que a cota vire dia 22, não dia 1º. Errar isso gera ticket de
suporte e disputa de fatura.

**Assumi mês calendário, ancorado em UTC.** É o que "limite mensal" significa em linguagem natural e
basta para o MVP. Ancoro em UTC de propósito, porque a virada precisa ser determinística: sem uma
âncora única ela aconteceria em horários diferentes conforme o fuso de quem consulta, e um cliente
poderia consumir duas cotas na fronteira.

<details>
<summary>O custo assumido e o custo se eu errei</summary>

Custo assumido: para um cliente em São Paulo, a cota vira às 21h do último dia do mês.

Se for ciclo por aniversário, seria preciso trocar a competência por uma janela `(início, fim)`
derivada da data de assinatura e reescrever a lógica de virada. **Custo médio-alto, é a suposição
estruturalmente mais cara desta lista.** Aceito porque a alternativa é modelar um ciclo de billing
completo, com proração e upgrade no meio do ciclo, que está claramente fora do MVP.
</details>

### 6. O bloqueio é hard ou existe overage?

Um bloqueio hard derruba o atendimento do cliente em produção. Nenhuma empresa corta o serviço do maior
cliente às 3h da manhã sem uma decisão comercial consciente.

**Assumi hard block, sem overage**, porque o briefing é literal: "o agente deveria parar de responder".
Toda execução recusada fica registrada, o que dá ao Comercial a lista exata de **demanda reprimida**,
ou seja, quanto o cliente teria consumido. Isso é gatilho de upsell com evidência, e é receita que hoje
se perde em silêncio.

<details>
<summary>O custo se eu errei</summary>

Overage é aditivo: um limite hard opcional no plano, ou um campo de tolerância. E os dados para tomar
essa decisão **já estarão sendo coletados** nas execuções bloqueadas. **Custo baixo.**
</details>

## 2. Entidades de negócio

| Entidade | O que é | Vira tabela? |
|---|---|---|
| **Cliente** | Empresa contratante. É a fronteira de tenant e a titular da cota. | ✅ |
| **Plano** | Catálogo comercial. Carrega o limite mensal. | ✅ |
| **Agente** | Agente de IA de um cliente. Unidade de atribuição de consumo. | ✅ |
| **Execução** | Uma chamada ao agente. Tabela de fatos, append-only. | ✅ |
| **Limite** | Citado no briefing como conceito. | ❌ atributo de Plano |
| **Competência** | A janela contra a qual a cota é medida. | ❌ atributo |
| **Bloqueio** | O evento "execução recusada por limite". | ❌ estado de Execução |

As quatro primeiras são diretas. As três decisões de **não** criar tabela são as que valem discussão,
porque modelar demais custa tanto quanto modelar de menos.

<details>
<summary>Por que Limite, Competência e Bloqueio não viraram tabelas</summary>

**Limite é atributo de Plano.** O briefing diz "cada plano tem um limite mensal", ou seja,
cardinalidade 1:1. Uma entidade própria só se justificaria com múltiplos limites por plano (execuções
e tokens e agentes), que é a evolução mais provável deste modelo. Não construo agora porque é YAGNI, e
promover um atributo a tabela depois é uma migração mecânica.

**Competência não é entidade.** A tentação é criar `uso_mensal (cliente, mês, total)`, uma linha por
cliente por mês, que daria histórico de consumo de graça. Rejeitei para o MVP porque o briefing pergunta
"quantas execuções **este mês**" e nunca "compare com o mês passado". Uma linha por mês exigiria um
upsert no caminho crítico e ainda deixaria "qual é o mês atual?" para o código resolver. Guardar a
competência junto do contador responde a pergunta do briefing com uma única leitura. Quando histórico
entrar no escopo, as execuções já contêm os fatos para reconstruir o passado.

**Bloqueio é estado de Execução.** Uma tentativa recusada **é** uma tentativa de execução: tem agente,
cliente e timestamp, igual às outras. Uma tabela separada duplicaria a estrutura e forçaria unir duas
tabelas para responder "o que aconteceu com este agente hoje?", que é literalmente a pergunta que o CS
faz.
</details>

## 3. Escopo do MVP

### Dentro

| Item | Por quê |
|---|---|
| Cadastro e listagem de agentes | Pedido explícito. |
| Registro de execução com **enforcement atômico de cota** | É a regra central. Todo o resto é acessório. |
| Bloqueio com status HTTP adequado, e a tentativa recusada registrada | Atende às duas leituras do parêntese de uma vez. |
| Histórico de execuções paginado | Pedido explícito. É como o CS diagnostica. |
| Auth simplificada e isolamento por cliente | Sem isso, um painel de CS é um vazamento de dados. |
| Dashboard com % de consumo e indicação visual de bloqueio | É a tela que resolve a dor do briefing. |
| Estados de loading, vazio e erro | O briefing pede "fácil de usar". Tela branca sob falha não é. |
| Testes da regra de bloqueio | É a única regra cuja falha custa dinheiro direto. |
| Log estruturado no bloqueio | Pedido explícito, e é o evento que o negócio audita. |
| CI com lint e testes | Pedido explícito. |

### Fora

| Item | Por que fica fora |
|---|---|
| Runtime do agente de IA | O desafio é o painel. A execução é simulada pelo endpoint de registro. |
| Cobrança, overage, proração | Depende da pergunta 5. Modelar billing sem definir o ciclo é construir a coisa errada com precisão. |
| **Alertas ativos (e-mail/Slack em 80%)** | Provavelmente o item de **maior valor real**, já que o briefing diz "ser **alertados**" e alerta é push, não tela. Fica fora por falta de definição de canal, destinatário e deduplicação, não por falta de valor. O MVP entrega o threshold visual. |
| Painel multi-tenant de CS | Ver pergunta 2. Aditivo depois, e a ordem inversa seria insegura. |
| Gestão de planos pela UI | Planos mudam raramente e são decisão comercial. Seed resolve. |
| Conversão de tokens em R$ | O dado é capturado para não se perder, mas precificação não foi especificada. |
| Retenção e particionamento do histórico | Só importa em outra ordem de grandeza. Ver riscos. |
| Refresh token, RBAC, OAuth | O desafio dispensa: "uma simplificação documentada é aceitável". |

## 4. Riscos que decidi não resolver agora

Não são itens esquecidos, são decisões conscientes de adiar. Para cada um, o que me deixa confortável
em seguir sem resolver.

**O painel pode não ser o produto certo.** O briefing pede "ser alertados", e alerta não é tela, é
notificação. Existe risco real de construir um dashboard que ninguém abre. Sigo porque é o desafio
proposto e porque o dashboard é pré-requisito honesto do alerta, já que todo alerta precisa de um
destino para onde apontar. Mas trato isso de frente na Etapa 7, e as métricas que vou propor são
desenhadas para **detectar** esse fracasso em vez de escondê-lo.

**O contador consolidado pode divergir dos fatos.** Manter um contador em vez de contar as execuções na
hora é o que torna a leitura barata, mas cria a chance de o contador mentir, e ele é a base do
faturamento. Sigo porque contador e execução são escritos na **mesma transação**, então o banco já
garante o invariante no caminho normal. O que falta é defesa contra bug de código, não contra falha de
infra. E como as execuções continuam registradas, a verdade é sempre reconstruível: um job de
reconciliação comparando contagem real com o contador fecha o risco depois, rodando fora do caminho
crítico.

**O histórico de execuções cresce sem limite.** É a tabela que mais cresce e nada a contém. Sigo porque
a decisão de particionar depende de volume real, que não temos, e particionar cedo é complexidade sem
retorno. O modelo não bloqueia essa evolução: a leitura de cota **não depende** do histórico, então dá
para particionar, arquivar ou expurgar sem tocar no dashboard nem no enforcement.

**Concorrência entre registrar execução e mudar de plano.** Se o Comercial faz upgrade no exato momento
de um bloqueio, o resultado depende de quem commita primeiro. Sigo porque nunca há estado corrompido:
no pior caso uma execução é recusada milissegundos antes de um upgrade que a teria permitido, e o
runtime já trata recusa com retry. Impacto real perto de zero.

**Não há RLS no banco.** O isolamento entre clientes depende de a aplicação sempre filtrar por cliente.
A FK composta protege a **escrita** (ver Etapa 1), mas não faz nada por um `SELECT` que esqueça o
filtro. Sigo porque o Postgres nunca é exposto direto ao usuário final nesta arquitetura, então a
superfície é só o nosso próprio código. Fica registrado porque é uma dívida real: se um dia a base for
exposta via PostgREST ou similar, RLS deixa de ser opcional.
