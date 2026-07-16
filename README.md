# Rotik Panel Agents

Painel fullstack para acompanhar agentes de IA por cliente, registrar execuções e impedir consumo acima
da cota mensal contratada. O projeto foi desenvolvido para o desafio técnico fullstack da Rotik.

**Produção:** [Frontend na Vercel](https://rotik-panel-agents.vercel.app) | [Documentação da API](https://rotik-agents-api-wendel211.onrender.com/docs) | [Healthcheck da API](https://rotik-agents-api-wendel211.onrender.com/health)

**Modelo de dados:** [diagrama público no dbdiagram.io](https://dbdiagram.io/d/modeloER-6a56e578067336e1de76f9d3)

**Stack:** React, TypeScript, Vite, TanStack Query, Node.js, Express, PostgreSQL, Vitest, Docker,
GitHub Actions, Vercel e Render.

## Visão do produto

O problema central não é apenas mostrar números. A Rotik precisa saber quando uma conta está perto do
limite, impedir que a cota seja ultrapassada e dar contexto suficiente para o time de CS agir sem
depender de planilhas ou de uma investigação manual em logs.

O MVP entrega:

- autenticação simplificada com JWT e isolamento por cliente;
- listagem de agentes com consumo mensal, limite e estado operacional;
- cadastro de agentes;
- simulação em lote com quantidade de execuções e projeção da cota antes do envio;
- bloqueio atômico na API e prevenção no painel quando o lote ultrapassa a cota disponível;
- limite de agentes por plano, com aviso em diálogo e proteção sob cadastros concorrentes;
- histórico paginado, incluindo tentativas bloqueadas;
- estados de loading, erro, vazio e feedback de atualização;
- interface responsiva, acessível e integrada à API real.

Contas públicas de demonstração:

| Conta | E-mail | Senha | Plano | Cota mensal | Limite de agentes | Objetivo da demonstração |
|---|---|---|---|---:|---:|---|
| Acme Atendimento | `cs@acme.dev` | `senha123` | Growth | 100 execuções, começando em 82 | 5 | Conta próxima do limite, ideal para validar alerta, projeção e bloqueio. |
| Globex Suporte | `cs@globex.dev` | `senha123` | Pro | 1.000 execuções, começando em 140 | 10 | Conta com margem de uso e maior capacidade, ideal para comparar o comportamento entre planos. |

As contas pertencem a tenants diferentes e nunca compartilham agentes, histórico ou consumo. A Acme usa o
plano Growth, com cota e capacidade menores; a Globex usa o plano Pro, com dez vezes mais execuções mensais
e o dobro de agentes. A cota mensal é medida em execuções, como define o briefing.

Ao clicar em **Simular lote**, o operador informa diretamente quantas execuções serão consumidas. A projeção
mostra o saldo atual, o consumo resultante e quantas execuções restarão. O painel não envia lotes acima do
saldo, enquanto a API mantém a mesma validação como garantia de segurança e concorrência. Ao tentar
cadastrar além da capacidade, um diálogo explica o limite do plano e as opções disponíveis.

Essas credenciais existem somente para avaliação do desafio e não representam uma estratégia de
autenticação para produção.

## Discovery

### Perguntas e suposições

O briefing deixa decisões importantes em aberto. Estas são as perguntas que eu faria e as suposições
adotadas para conseguir avançar com segurança.

| Pergunta | Suposição adotada | Consequência |
|---|---|---|
| O limite pertence ao cliente ou a cada agente? | A cota é compartilhada por todos os agentes do cliente. | O bloqueio precisa serializar o consumo na linha do cliente, não na linha do agente. |
| O usuário do MVP é o CS da Rotik ou o cliente final? | A autenticação representa um cliente. | O isolamento entre tenants fica demonstrável, mas uma visão interna de CS com busca entre contas fica fora do MVP. |
| A API executa o agente de IA? | Não. Ela registra uma execução já solicitada por outro serviço. | O projeto controla consumo e auditoria sem inventar integração com um provedor de IA. |
| O que conta como execução? | Toda chamada aceita consome uma unidade, independentemente do agente. | A simulação pode enviar um lote para acelerar o teste, mas a cota avança pela quantidade de chamadas. Tokens e duração ficam registrados como métricas. |
| Uma execução que termina com erro consome cota? | Sim. Depois que a chamada é aceita, ela consome uma unidade mesmo que o processamento termine com erro. | O consumo representa o uso da operação, enquanto o status preserva o resultado para diagnóstico. Rejeições anteriores à execução, como agente pausado, não consomem cota. |
| Como foram definidos os limites de agentes dos planos? | Os nomes Growth e Pro e a diferenciação de capacidade foram baseados na [página pública de planos da Rotik](https://rotik.io/). Para a demonstração, foi adotada a regra Growth com 5 agentes e Pro com 10. | A regra aproxima o cenário do produto real e permite testar capacidade e concorrência. Ela continua isolada no plano para poder acompanhar futuras alterações comerciais sem mudar a lógica de cadastro. |
| O período mensal segue mês calendário ou ciclo de cobrança? | Mês calendário em UTC. | O contador pode ser reiniciado de forma preguiçosa sem depender de cron. Um produto real precisaria confirmar fuso e ciclo contratual. |
| O bloqueio é rígido ou permite excedente pago? | O bloqueio é rígido ao atingir o limite. | A tentativa excedente recebe `429`, não incrementa consumo e permanece no histórico como bloqueada. |
| Agente pausado pode registrar execução? | Não. | A API rejeita a operação antes de consumir cota. |

### Conceitos de negócio

| Conceito | Responsabilidade |
|---|---|
| Plano | Define nome, quantidade máxima de agentes cadastrados e limite mensal de execuções. |
| Cliente | Tenant autenticado, plano contratado e contador consolidado da competência atual. |
| Agente | Automação pertencente a um único cliente, com estado ativo ou pausado. |
| Execução | Fato auditável aceito ou bloqueado, vinculado ao cliente e ao agente. |
| Competência | Mês ao qual o contador consolidado se refere. |

### Escopo e limites do MVP

Entram no MVP a regra de cota, o isolamento por cliente, o cadastro de agente, o histórico e a interface
operacional. Ficam fora OAuth, refresh token, recuperação de senha, cobrança por excedente, alteração de
plano, notificações por e-mail ou Slack, execução real de modelos e um papel administrativo capaz de
alternar entre clientes.

Esses cortes são intencionais. Eles preservam o problema principal e evitam que integrações não
especificadas escondam a qualidade da regra transacional.

### Riscos e ambiguidades ainda abertas

Algumas decisões precisam ser confirmadas antes de transformar o MVP em produto:

- ciclo de cobrança, fuso horário e política de tolerância podem mudar o momento correto do bloqueio;
- um painel interno de CS exige autorização administrativa, trilha de auditoria e busca entre tenants;
- agentes pausados, falhas do provedor e reprocessamentos podem ter regras de faturamento diferentes;
- o contador consolidado pode divergir dos fatos caso uma manutenção manual seja feita fora da API;
- alertas precisam de canal, destinatário, deduplicação e política de reenvio;
- o banco gratuito da demonstração expira e não possui a durabilidade esperada para dados reais.

Eu não tentei resolver essas ambiguidades inventando regras. O sistema deixa as decisões localizadas e
documenta onde a confirmação de produto altera o comportamento.

## Arquitetura e decisões técnicas

### Modelo de dados

O PostgreSQL foi escolhido porque a regra central exige consistência transacional. Uma execução aceita
precisa incrementar o contador e criar o fato de auditoria como uma única operação.

O modelo permanece normalizado para plano, cliente, agente e execução. A exceção deliberada é
`clientes.execucoes_mes_atual`, um contador consolidado que torna a leitura do painel constante, sem
executar `COUNT(*)` sobre um histórico que cresce continuamente.

Ao registrar uma execução ou lote, a API:

1. identifica o cliente exclusivamente pelo JWT validado;
2. verifica se o agente pertence ao mesmo cliente e está ativo;
3. atualiza o contador somente quando existe saldo para o lote inteiro;
4. grava a execução aceita e a quantidade representada na mesma transação;
5. grava a tentativa bloqueada sem consumo parcial quando o lote ultrapassa o saldo.

O update condicional e o lock da linha eliminam a corrida entre requisições concorrentes. As chaves
estrangeiras compostas reforçam no banco que uma execução não pode misturar cliente e agente de tenants
diferentes.

Índices relevantes:

- agentes por `cliente_id` e data de criação;
- execuções por `agente_id`, data e identificador para paginação keyset;
- execuções bloqueadas por cliente para investigação operacional;
- nomes de plano únicos sem diferença entre maiúsculas e minúsculas.

### Backend

A API usa Express, TypeScript estrito, `pg` e Zod. O uso de SQL explícito deixa a transação de cota
visível e evita esconder o trecho mais importante atrás de abstrações de ORM.

| Método | Rota | Função |
|---|---|---|
| `GET` | `/health` | Verifica processo e conexão com PostgreSQL. |
| `POST` | `/auth/login` | Retorna JWT e dados do cliente. |
| `GET` | `/agents` | Lista agentes e consumo consolidado da conta. |
| `POST` | `/agents` | Cadastra um agente no cliente autenticado. |
| `POST` | `/agents/:id/executions` | Registra ou bloqueia atomicamente um lote de 1 a 1.000 execuções. |
| `GET` | `/agents/:id/executions` | Lista histórico com paginação por cursor. |

O `clienteId` nunca é aceito pelo body, query string ou parâmetro de rota. Ele é escrito no request
somente depois da verificação do JWT. Assim, um cliente não consegue consultar outro apenas trocando um
identificador enviado pelo navegador.

Erros seguem o mesmo contrato JSON, usam status HTTP coerentes e não devolvem stack trace ou detalhes
do banco. Entradas são validadas antes de chegar aos services. O login compara bcrypt com um hash falso
mesmo quando o e-mail não existe, reduzindo diferença de tempo que poderia revelar contas cadastradas.

### Frontend

O frontend usa React, TanStack Query e Context apenas onde o estado realmente é global.

- sessão e tema ficam em contexto;
- dados remotos, cache, revalidação e mutations ficam no TanStack Query;
- formulários e abertura de diálogos permanecem locais aos componentes;
- contratos recebidos da API são validados com Zod;
- histórico usa paginação em vez de carregar toda a tabela;
- loading, erro e lista vazia têm estados próprios;
- a atualização manual mantém os dados anteriores, mostra progresso e confirma o sucesso.

A interface funciona em mobile e desktop, possui labels, foco visível, HTML semântico e contraste
adequado nos temas claro e escuro. Cor não é o único indicador de estado. Os cards também usam texto,
selos e borda completa para diferenciar ativo, pausado e bloqueado.

## Como executar localmente

Pré-requisitos: Node.js 22 ou superior, Docker Desktop e as portas 5432, 3333 e 5173 disponíveis.

Na raiz do repositório, prepare os arquivos locais:

```powershell
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

Suba o PostgreSQL:

```powershell
docker compose up -d
docker compose ps
```

Inicie a API em um segundo terminal, ainda a partir da raiz:

```powershell
npm --prefix backend ci
npm --prefix backend run dev
```

Inicie o frontend em um terceiro terminal:

```powershell
npm --prefix frontend ci
npm --prefix frontend run dev
```

Abra `http://localhost:5173`. A API estará em `http://localhost:3333`.

A documentação interativa Swagger fica em `http://localhost:3333/docs`. Para testar rotas protegidas,
faça login pela própria página, copie o `token`, clique em **Authorize** e informe somente o JWT. O
contrato OpenAPI em JSON também está disponível em `http://localhost:3333/docs.json`.

Se você já estiver dentro da pasta `backend`, execute `npm ci` e `npm run dev`, sem o prefixo. Usar
`npm --prefix backend` de dentro dela procura incorretamente por `backend/backend/package.json`.

Para validar a infraestrutura local:

```powershell
Invoke-RestMethod http://localhost:3333/health
```

Se a porta 3333 estiver ocupada, existe outra instância da API em execução. Isso deve ser resolvido no
processo ou na configuração da porta, não iniciando servidores duplicados.

## Qualidade, testes e evidências de debug

Vitest, Testing Library e Supertest cobrem componentes, autenticação, validação, autorização, histórico,
quota e integração HTTP. O backend usa PostgreSQL 16 real no teste de concorrência.

| Projeto | Testes | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|---:|
| Backend | 12 | 97,35% | 92,85% | 95,23% | 97,25% |
| Frontend | 29 | 97,93% | 92,08% | 99,19% | 99,41% |

Para executar a mesma base de validação local:

```powershell
docker compose up -d

npm --prefix backend ci
npm --prefix backend run lint
npm --prefix backend run typecheck
npm --prefix backend run build
npm --prefix backend run test:coverage

npm --prefix frontend ci
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
npm --prefix frontend run test:coverage
```

### Erros encontrados durante o desenvolvimento

O primeiro desenho da cota fazia leitura, comparação e incremento em comandos separados. Em um teste
com 112 requisições concorrentes e limite 100, o padrão ingênuo terminou em 112 de 100. Doze execuções
passaram porque várias requisições leram o mesmo saldo antes do update. A correção foi mover a decisão
para um update condicional dentro da transação. O teste atual aceita exatamente 100 e devolve `429` nas
12 restantes.

A evolução para lotes mantém a mesma garantia: 12 requisições concorrentes de 10 execuções contra uma
cota de 100 aceitam exatamente 10 lotes. Os dois restantes recebem `429`, e nenhum lote é parcialmente
consumido. O limite de agentes também é serializado na linha do cliente; oito cadastros concorrentes com
apenas quatro vagas terminam com exatamente cinco agentes no Growth.

No tema claro, algumas cores não mudavam porque `@apply` havia convertido tokens em valores literais no
build. O override do tema alterava a variável, mas o componente já não a utilizava. As superfícies que
dependem do tema passaram a referenciar propriedades CSS diretamente.

No primeiro deploy da Render, `dockerCommand` foi interpretado como um executável literal e o container
encerrou com status 127. O comando de migration e start foi movido para o `CMD` da própria imagem, que é
portável e também foi validado no job de build do CI.

Durante o teste local apareceu `EADDRINUSE` na porta 3333. A causa era uma API anterior ainda ativa, não
uma falha do Express. Esse caso motivou a observação explícita nas instruções locais, porque iniciar uma
segunda instância mascara qual código está realmente sendo testado.

Esses erros representam três classes diferentes de falha: concorrência que passa em teste sequencial,
estilo que compila mas perde semântica em runtime e configuração que funciona em uma plataforma mas não
em outra. Por isso a validação combina testes, banco real, build de container e smoke test publicado.

## Deploy, configuração e observabilidade

O frontend está na Vercel. A API Docker e o PostgreSQL privado estão na Render. `vercel.json` define
fallback da SPA, cache e headers de segurança. `render.yaml` descreve serviço, banco, healthcheck,
variáveis e deploy condicionado ao CI.

O workflow `.github/workflows/ci.yml` roda em todo push e pull request. Ele executa lint, typecheck,
build, testes com cobertura usando PostgreSQL real e build das imagens de produção. Uma mudança só fica
apta para deploy depois que essas verificações passam.

Nenhuma credencial fica no repositório. `JWT_SECRET` é gerado pelo provedor e `DATABASE_URL` é obtida
diretamente do recurso de banco. Localmente, apenas arquivos `.env` ignorados pelo Git recebem valores.

Variáveis principais:

| Variável | Serviço | Finalidade |
|---|---|---|
| `DATABASE_URL` | API | conexão com PostgreSQL |
| `DATABASE_SSL` | API | política de TLS do ambiente |
| `JWT_SECRET` | API | assinatura dos tokens |
| `JWT_EXPIRES_IN` | API | duração da sessão |
| `CORS_ORIGIN` | API | origens autorizadas |
| `LOG_LEVEL` | API | verbosidade dos logs |
| `VITE_API_URL` | Frontend | URL da API incorporada no build |
| `ALLOW_DEMO_SEED` | Banco | autorização explícita para dados de demonstração |

As migrations são versionadas, registram checksum e usam advisory lock. A migration de limites adiciona
as colunas sem alterar checksums já aplicados, normaliza o segundo plano como Pro e configura Growth com 5 e
Pro com 10 agentes. Isso permite executar
`npm run db:deploy` em cada cold start sem duplicar schema ou seed e impede dois containers de aplicar a
mesma migration simultaneamente.

O backend usa Pino e registra inicialização, encerramento, login, erros e bloqueios de cota. Senha,
token, hash e cabeçalho de autorização são removidos dos logs.

Em produção eu acompanharia:

- disponibilidade de `/health`, taxa de 5xx e latência p50, p95 e p99;
- conexões do banco, espera pelo pool, locks e transações abortadas;
- contas acima de 80%, bloqueios por cliente e volume de demanda reprimida;
- divergência entre contador consolidado e execuções aceitas;
- erros do frontend e falhas de integração com a API.

Um alerta técnico deve chegar à engenharia quando a aplicação ou o banco degrada. Um alerta de consumo
deve chegar a CS ou Comercial antes do bloqueio, com deduplicação por cliente e competência.

A hospedagem gratuita é suficiente para demonstrar o desafio, mas não para operar dados reais. A API
pode sofrer cold start e o banco gratuito possui prazo e garantias limitadas. Uma versão comercial
precisa de instâncias persistentes, backups, recuperação point in time e retenção de logs definida.

## Mentalidade de produto

### Esta funcionalidade gera valor real para a Rotik?

Sim, mas o valor não é igual para todo mundo. O ganho mais imediato está no CS. Hoje a pergunta prática
é se o agente parou por erro, configuração ou falta de cota. O painel responde isso sem pedir ajuda à
engenharia e mostra o histórico necessário para conversar com o cliente com algum contexto.

O Comercial recebe um sinal útil quando uma conta se aproxima do limite. Isso pode indicar necessidade
de upgrade, mas eu evitaria transformar todo alerta em oportunidade de venda. Às vezes o crescimento é
temporário ou consequência de uma configuração ruim. O dado ajuda a priorizar a conversa, não substitui
o julgamento de quem atende a conta.

Produto e Engenharia ganham visibilidade sobre uso real, bloqueios e concentração de consumo. Para o
cliente final, o benefício é indireto: menos interrupção inesperada e uma resposta mais rápida quando
algo dá errado. A interface atual ainda não é um painel interno completo de CS, pois cada login enxerga
um único tenant. Para uso interno real, seria necessário um papel administrativo auditável e uma busca
segura entre contas.

### Existe uma solução mais simples?

Existe. Para resolver apenas o problema mais urgente do briefing, eu começaria com o contador seguro e
um alerta automático quando a conta atingir 80% e 100% da cota. Um relatório diário enviado ao canal do
CS, com cliente, plano, consumo e agentes responsáveis, já eliminaria boa parte da dependência de
planilhas e evitaria muitos bloqueios sem exigir um painel completo.

Essa solução é menos confortável para investigação e não resolve cadastro ou histórico detalhado, mas
ataca diretamente a palavra mais importante do briefing: ser alertado. O painel passa a fazer mais
sentido quando o volume de contas torna o relatório difícil de operar ou quando CS precisa investigar
várias ocorrências por dia.

### Vale a pena investir nisso agora?

Eu investiria, mas em uma sequência curta e orientada por risco. Primeiro garantiria que a medição e o
bloqueio são confiáveis. Depois colocaria alertas proativos nas mãos do CS. Só então ampliaria o painel
com visão multi-tenant, filtros, responsáveis e ações comerciais.

Não defenderia meses de evolução visual antes de medir a frequência do problema. Se a Rotik tem poucas
contas próximas da cota e quase nenhum chamado relacionado, um relatório automatizado pode ser a melhor
decisão por algum tempo. Se bloqueios já interrompem atendimento, geram tickets ou escondem demanda por
upgrade, então a funcionalidade merece prioridade porque afeta suporte, receita e confiança ao mesmo
tempo.

A decisão deveria partir de uma linha de base: quantos bloqueios acontecem, quanto tempo CS leva para
diagnosticar e quantas vezes Engenharia precisa consultar logs. Sem essa referência, qualquer avaliação
de sucesso vira apenas percepção.

### Como medir se está dando certo?

Eu usaria três métricas que conectam produto a resultado operacional.

1. **Tempo para agir sobre risco de cota.** Mediria o intervalo entre atingir 80% e a primeira ação
   registrada pelo CS. A meta inicial seria agir no mesmo dia útil para a maioria das contas relevantes.
2. **Bloqueios evitáveis.** Acompanharia a proporção de clientes que chegam a 100% sem upgrade, ajuste ou
   contato prévio. A métrica deve cair depois dos alertas, sem exigir que o limite deixe de proteger o
   sistema.
3. **Autonomia no diagnóstico.** Mediria quantos incidentes de agente ou cota são resolvidos por CS sem
   consulta manual a logs e quanto tempo levam. Se o painel é usado, mas o tempo de resolução não melhora,
   ele está exibindo dados sem realmente resolver o trabalho.

Também observaria efeitos colaterais. Muitos alertas ignorados indicam ruído ou threshold ruim. Um aumento
de upgrades acompanhado por mais reclamações pode significar abordagem comercial agressiva. A intenção
é antecipar problemas e melhorar decisões, não apenas aumentar cliques no painel.

## Licença e uso

Projeto criado exclusivamente para avaliação técnica. As contas e dados publicados são fictícios.
