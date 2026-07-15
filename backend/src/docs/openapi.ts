type Schema = Record<string, unknown>;

const uuid = { type: 'string', format: 'uuid' };
const dateTime = { type: 'string', format: 'date-time' };
const nonnegativeInteger = { type: 'integer', minimum: 0 };
const nullableInteger = { type: 'integer', nullable: true };
const nullableString = { type: 'string', nullable: true };

function object(required: string[], properties: Record<string, Schema>): Schema {
  return { type: 'object', required, properties, additionalProperties: false };
}

function errorResponse(description: string, code: string): Schema {
  return {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/Error' },
        example: { erro: { codigo: code, mensagem: description } },
      },
    },
  };
}

const invalidData = errorResponse('Os dados enviados não passaram na validação.', 'DADOS_INVALIDOS');
const unauthorized = errorResponse('Credenciais ausentes ou inválidas.', 'NAO_AUTENTICADO');

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Rotik Panel Agents API',
    version: '1.0.0',
    description: 'API para autenticação, gerenciamento de agentes e controle de execuções mensais.',
  },
  servers: [
    { url: '/', description: 'Servidor atual' },
    { url: 'http://localhost:3333', description: 'Desenvolvimento local' },
  ],
  tags: [
    { name: 'Infraestrutura' },
    { name: 'Autenticação' },
    { name: 'Agentes' },
    { name: 'Execuções' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Infraestrutura'], summary: 'Verifica a saúde da API e do PostgreSQL', operationId: 'getHealth',
        responses: {
          '200': { description: 'API e banco disponíveis.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' }, example: { status: 'ok', banco: 'ok', timestamp: '2026-07-15T12:00:00.000Z' } } } },
          '503': { description: 'Banco indisponível.', content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' }, example: { status: 'degradado', banco: 'indisponivel', timestamp: '2026-07-15T12:00:00.000Z' } } } },
          '500': errorResponse('Erro interno no servidor.', 'ERRO_INTERNO'),
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Autenticação'], summary: 'Autentica um cliente', operationId: 'login',
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' }, example: { email: 'cs@acme.dev', senha: 'senha123' } } } },
        responses: {
          '200': { description: 'Login realizado.', content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginResponse' } } } },
          '400': invalidData,
          '401': errorResponse('E-mail ou senha incorretos.', 'NAO_AUTENTICADO'),
          '500': errorResponse('Erro interno no servidor.', 'ERRO_INTERNO'),
        },
      },
    },
    '/agents': {
      get: {
        tags: ['Agentes'], summary: 'Lista os agentes do cliente autenticado', operationId: 'listAgents', security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Agentes, consumo consolidado e limites da conta, inclusive quando a lista está vazia.', content: { 'application/json': { schema: object(['data', 'meta'], { data: { type: 'array', items: { $ref: '#/components/schemas/Agent' } }, meta: { $ref: '#/components/schemas/AgentLimits' } }) } } },
          '401': unauthorized,
          '500': errorResponse('Erro interno no servidor.', 'ERRO_INTERNO'),
        },
      },
      post: {
        tags: ['Agentes'], summary: 'Cadastra um agente', operationId: 'createAgent', security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAgentInput' }, example: { nome: 'Assistente de suporte', descricao: 'Responde dúvidas de clientes.' } } } },
        responses: {
          '201': { description: 'Agente criado.', content: { 'application/json': { schema: object(['data'], { data: { $ref: '#/components/schemas/Agent' } }) } } },
          '400': invalidData, '401': unauthorized,
          '409': errorResponse('Agente duplicado ou limite de agentes do plano atingido.', 'LIMITE_AGENTES_ATINGIDO'),
          '500': errorResponse('Erro interno no servidor.', 'ERRO_INTERNO'),
        },
      },
    },
    '/agents/{id}/executions': {
      parameters: [{ name: 'id', in: 'path', required: true, description: 'UUID do agente.', schema: uuid }],
      post: {
        tags: ['Execuções'], summary: 'Registra uma execução', operationId: 'createExecution', security: [{ bearerAuth: [] }],
        description: 'Consome de 1 a 1.000 execuções da cota em um lote atômico: ou todo o lote é aceito, ou a tentativa é registrada como bloqueada e retorna 429.',
        requestBody: { required: false, content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateExecutionInput' }, examples: { sucesso: { value: { status: 'sucesso', duracaoMs: 820, tokensEntrada: 120, tokensSaida: 48 } }, erro: { value: { status: 'erro', mensagemErro: 'Provedor indisponível.' } } } } } },
        responses: {
          '201': { description: 'Execução registrada.', content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateExecutionResponse' } } } },
          '400': invalidData, '401': unauthorized,
          '404': errorResponse('Agente não encontrado.', 'NAO_ENCONTRADO'),
          '409': errorResponse('O agente está inativo.', 'AGENTE_INATIVO'),
          '429': { description: 'Cota mensal atingida; tentativa registrada como bloqueada.', headers: { 'Retry-After': { description: 'Segundos até a próxima competência mensal em UTC.', schema: { type: 'integer', minimum: 1 } } }, content: { 'application/json': { schema: { $ref: '#/components/schemas/QuotaError' } } } },
          '500': errorResponse('Erro interno no servidor.', 'ERRO_INTERNO'),
        },
      },
      get: {
        tags: ['Execuções'], summary: 'Lista o histórico paginado', operationId: 'listExecutions', security: [{ bearerAuth: [] }],
        description: 'Usa paginação keyset. O cursor retornado deve ser tratado como opaco.',
        parameters: [
          { name: 'limite', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { name: 'cursor', in: 'query', required: false, description: 'proximoCursor recebido na página anterior.', schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Página do histórico.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ExecutionPage' } } } },
          '400': invalidData, '401': unauthorized,
          '404': errorResponse('Agente não encontrado.', 'NAO_ENCONTRADO'),
          '500': errorResponse('Erro interno no servidor.', 'ERRO_INTERNO'),
        },
      },
    },
  },
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT retornado por POST /auth/login.' } },
    schemas: {
      Health: object(['status', 'banco', 'timestamp'], { status: { type: 'string', enum: ['ok', 'degradado'] }, banco: { type: 'string', enum: ['ok', 'indisponivel'] }, timestamp: dateTime }),
      LoginInput: object(['email', 'senha'], { email: { type: 'string', format: 'email' }, senha: { type: 'string', minLength: 1, format: 'password' } }),
      LoginResponse: object(['token', 'cliente'], { token: { type: 'string' }, cliente: object(['id', 'nome', 'email'], { id: uuid, nome: { type: 'string' }, email: { type: 'string', format: 'email' } }) }),
      CreateAgentInput: object(['nome'], { nome: { type: 'string', minLength: 1, maxLength: 120 }, descricao: { type: 'string', maxLength: 500 } }),
      AgentLimits: object(['plano', 'agentes'], { plano: object(['id', 'nome', 'limiteAgentes'], { id: uuid, nome: { type: 'string' }, limiteAgentes: nonnegativeInteger }), agentes: object(['usado', 'limite', 'restante'], { usado: nonnegativeInteger, limite: nonnegativeInteger, restante: nonnegativeInteger }) }),
      Agent: object(['id', 'nome', 'descricao', 'status', 'bloqueado', 'criadoEm', 'ultimaExecucaoEm', 'totalExecucoes', 'plano', 'agentes', 'consumo'], {
        id: uuid, nome: { type: 'string' }, descricao: nullableString, status: { type: 'string', enum: ['ativo', 'pausado', 'arquivado'] }, bloqueado: { type: 'boolean' }, criadoEm: dateTime, ultimaExecucaoEm: { ...dateTime, nullable: true }, totalExecucoes: nonnegativeInteger,
        plano: object(['id', 'nome', 'limiteAgentes'], { id: uuid, nome: { type: 'string' }, limiteAgentes: nonnegativeInteger }),
        agentes: object(['usado', 'limite', 'restante'], { usado: nonnegativeInteger, limite: nonnegativeInteger, restante: nonnegativeInteger }),
        consumo: object(['execucoesMesAgente', 'execucoesMesCliente', 'limiteMensal', 'restante', 'percentualUsoCliente'], { execucoesMesAgente: nonnegativeInteger, execucoesMesCliente: nonnegativeInteger, limiteMensal: nonnegativeInteger, restante: nonnegativeInteger, percentualUsoCliente: { type: 'number', minimum: 0 } }),
      }),
      CreateExecutionInput: object([], { quantidadeExecucoes: { type: 'integer', minimum: 1, maximum: 1000, default: 1, description: 'Quantidade de execuções simuladas no lote.' }, status: { type: 'string', enum: ['sucesso', 'erro'], default: 'sucesso' }, duracaoMs: { type: 'integer', minimum: 0, maximum: 600000 }, tokensEntrada: { ...nonnegativeInteger, maximum: 10000000, description: 'Tokens de entrada por execução.' }, tokensSaida: { ...nonnegativeInteger, maximum: 10000000, description: 'Tokens de saída por execução.' }, mensagemErro: { type: 'string', maxLength: 1000, description: 'Permitida somente quando status é erro.' } }),
      CreateExecutionResponse: object(['data'], { data: object(['id', 'status', 'criadoEm', 'quantidadeExecucoes', 'consumo'], { id: uuid, status: { type: 'string', enum: ['sucesso', 'erro'] }, criadoEm: dateTime, quantidadeExecucoes: { type: 'integer', minimum: 1, maximum: 1000 }, consumo: object(['usado', 'limite', 'restante'], { usado: nonnegativeInteger, limite: nonnegativeInteger, restante: nonnegativeInteger }) }) }),
      Execution: object(['id', 'status', 'duracaoMs', 'tokensEntrada', 'tokensSaida', 'quantidadeExecucoes', 'mensagemErro', 'criadoEm'], { id: uuid, status: { type: 'string', enum: ['sucesso', 'erro', 'bloqueada'] }, duracaoMs: nullableInteger, tokensEntrada: nullableInteger, tokensSaida: nullableInteger, quantidadeExecucoes: { type: 'integer', minimum: 1, maximum: 1000 }, mensagemErro: nullableString, criadoEm: dateTime }),
      ExecutionPage: object(['data', 'proximoCursor'], { data: { type: 'array', items: { $ref: '#/components/schemas/Execution' } }, proximoCursor: { type: 'string', nullable: true } }),
      Error: object(['erro'], { erro: object(['codigo', 'mensagem'], { codigo: { type: 'string' }, mensagem: { type: 'string' }, detalhes: {} }) }),
      QuotaError: object(['erro'], { erro: object(['codigo', 'mensagem', 'detalhes'], { codigo: { type: 'string', example: 'LIMITE_PLANO_ATINGIDO' }, mensagem: { type: 'string' }, detalhes: object(['usado', 'limite', 'retryAfterSegundos'], { usado: nonnegativeInteger, limite: nonnegativeInteger, retryAfterSegundos: { type: 'integer', minimum: 1 } }) }) }),
    },
  },
};
