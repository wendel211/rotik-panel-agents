/**
 * Augmentation do Request do Express.
 *
 * Mora num arquivo próprio, e não dentro do middleware de auth, por dois
 * motivos: augmentation global escondida num módulo é surpreendente para quem
 * lê, e prende o tipo à ordem de importação. Aqui ela é declarativa e vale para
 * o projeto inteiro.
 *
 * `clienteId` é a fronteira de tenant do sistema. Ele só é escrito pelo
 * middleware `autenticar`, a partir do JWT verificado, e NUNCA a partir de
 * body, query ou params. Se o tenant pudesse vir do request, bastaria o cliente
 * A mandar o id do cliente B.
 *
 * Opcional de propósito: em rotas públicas (/health, /auth/login) ele não
 * existe, e o tipo deve refletir isso em vez de mentir com `string`.
 */
declare global {
  namespace Express {
    interface Request {
      clienteId?: string;
    }
  }
}

export {};
