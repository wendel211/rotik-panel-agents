/**
 * Os pacotes do Fontsource só emitem CSS, então não trazem tipos.
 *
 * Sem estas declarações o `verbatimModuleSyntax` do tsconfig recusa o import
 * de efeito colateral (TS2882). Declarar o módulo é o caminho suportado: não
 * enfraquece a checagem em lugar nenhum, só informa ao compilador que o import
 * existe e não exporta nada.
 */
declare module '@fontsource-variable/inter'
declare module '@fontsource-variable/jetbrains-mono'
