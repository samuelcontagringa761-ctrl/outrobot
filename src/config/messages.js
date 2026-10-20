/**
 * Padrão de escrita do bot — fonte única de verdade para textos e formatação.
 *
 * REGRAS DO PADRÃO
 * 1. Toda mensagem começa com UM emoji, escolhido pelo significado:
 *      ⚠️  limitação/atenção (só em grupos, precisa marcar alguém, valor inválido)
 *      ❌  falha real (não consegui baixar, erro de API, não encontrado)
 *      ✅  sucesso de uma ação
 *      ℹ️  instrução de uso ou informação neutra
 *      🎲🎯📥  emoji temático, quando a mensagem é parte de um jogo/áudio/vídeo
 *    Nunca dois emojis seguidos na abertura, nunca `⚠️` para coisa que não é aviso.
 * 2. Negrito (*assim*) só em destaque real: nome, número, estado, comando.
 * 3. Frase curta, direta, português correto, terminando com pontuação.
 * 4. Texto repetido não se copia: usa-se as constantes deste arquivo.
 */

export const BOT_NAME = 'SERIE BOT';

// ── Textos que se repetiam em dezenas de arquivos ────────────────────────────
export const TEXTO = {
  somenteGrupo: 'Este comando só funciona em grupos.',
  somenteAdmin: 'Só administradores do grupo podem usar este comando.',
  somenteDono: 'Só o dono do bot pode usar este comando.',
  adminOuDono: 'Só administradores do grupo ou o dono do bot podem usar este comando.',
  botPrecisaAdmin: 'Preciso ser administrador do grupo para fazer isso.',
  alvoNaoEncontrado: 'Não encontrei essa pessoa no grupo. Marque alguém ou responda a uma mensagem dela.',
  marcaAlguem: 'Marque alguém ou responda a uma mensagem da pessoa.',
  semMidia: 'Envie uma imagem junto com o comando, ou responda a uma imagem.',
  erroInterno: (cmd) => `Não consegui executar \`/${cmd}\` agora. Tente novamente em instantes.`,
  tenteNovamente: 'Não deu certo agora. Tente novamente em instantes.',
};

// ── Construtores (o emoji já vem incluso) ────────────────────────────────────
export const aviso = (texto) => `⚠️ ${texto}`;
export const erro = (texto) => `❌ ${texto}`;
export const sucesso = (texto) => `✅ ${texto}`;
export const info = (texto) => `ℹ️ ${texto}`;

/** Instrução de uso. `exemplo` já deve incluir o prefixo, ex: `/cep 01001000`. */
export const uso = (exemplo, dica) =>
  `ℹ️ *Como usar:* \`${exemplo}\`${dica ? `\n${dica}` : ''}`;

/** Limitação de contexto (só em grupo, só admin...) — sempre em ⚠️. */
export const grupoApenas = () => aviso(TEXTO.somenteGrupo);
export const adminApenas = () => aviso(TEXTO.somenteAdmin);
export const donoApenas = () => aviso(TEXTO.somenteDono);
export const adminOuDonoApenas = () => aviso(TEXTO.adminOuDono);
export const botPrecisaAdmin = () => aviso(TEXTO.botPrecisaAdmin);
export const alvoNaoEncontrado = () => aviso(TEXTO.alvoNaoEncontrado);
export const marcaAlguem = () => aviso(TEXTO.marcaAlguem);

/** Falha genérica de um comando, já citando o comando na mensagem. */
export const erroInterno = (cmd) => erro(TEXTO.erroInterno(cmd));

/** Bloco com título: `cabecalho('🎲', 'Roleta Russa')`. */
export const cabecalho = (emoji, titulo) => `${emoji} *${String(titulo).toUpperCase()}*`;

/** Linha "Rótulo: valor" com o valor em negrito — padrão dos relatórios. */
export const linha = (rotulo, valor) => `${rotulo}: *${valor}*`;

/** Estado ligado/desligado com negrito, para mensagens de configuração. */
export const estado = (ligado) => (ligado ? 'ativado' : 'desativado');
