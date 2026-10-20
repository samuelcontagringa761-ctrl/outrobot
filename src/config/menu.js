/**
 * Menu do bot. Fica separado do handler para ser fácil de manter:
 * adicionar ou mudar um comando aqui não mexe na lógica de nenhum outro arquivo.
 *
 * Padrão de cada linha:  /comando <argumentos> — Descrição
 *  - argumentos entre < > são obrigatórios, [ ] são opcionais
 *  - descrição começa com verbo, sem ponto final, uma linha só
 */

import { BOT_NAME } from './messages.js';

export const CATEGORIAS = [
  {
    emoji: '📥',
    titulo: 'MÍDIA & DOWNLOADS',
    comandos: [
      ['play <música ou link>', 'Baixar música do YouTube'],
      ['video <vídeo ou link>', 'Baixar vídeo do YouTube'],
      ['tiktok <link>', 'Baixar vídeo do TikTok sem marca d\'água'],
      ['ig <link>', 'Baixar vídeo ou Reels do Instagram'],
      ['tiktokaudio <link>', 'Baixar só o áudio de um TikTok'],
      ['igaudio <link>', 'Baixar só o áudio de um Instagram'],
      ['sticker', 'Criar figurinha de imagem ou vídeo'],
      ['sticker2', 'Figurinha com a proporção original, sem distorcer'],
      ['sticker3', 'Figurinha maior, preenchendo o quadrado'],
      ['unsticker', 'Transformar figurinha em imagem'],
      ['ver', 'Revelar mídia de visualização única (restrito)'],
    ],
  },
  {
    emoji: '🤖',
    titulo: 'INTELIGÊNCIA ARTIFICIAL',
    comandos: [
      ['ia <pergunta>', 'Pesquisar na internet e responder, lembrando o fio da conversa'],
    ],
  },
  {
    emoji: '⚔️',
    titulo: 'RPG & BATALHAS',
    comandos: [
      ['classe <guerreiro|mago|arqueiro>', 'Escolher a sua classe'],
      ['missao', 'Ver ou iniciar as missões do dia'],
      ['raid', 'Entrar na raid contra o chefe do grupo'],
      ['curar', 'Recuperar vida com poção ou descanso'],
      ['perfil', 'Ver nível, vida e moedas'],
    ],
  },
  {
    emoji: '🎰',
    titulo: 'CASSINO & MINIGAMES',
    comandos: [
      ['blackjack <aposta>', 'Jogar 21 contra a banca'],
      ['poker <aposta>', 'Disputar uma mão rápida de poker'],
      ['slots <aposta>', 'Girar o caça-níqueis'],
      ['pescar', 'Pescar peixes e itens raros'],
    ],
  },
  {
    emoji: '💍',
    titulo: 'CASAMENTO & SOCIAL',
    comandos: [
      ['casar @pessoa', 'Fazer um pedido de casamento'],
      ['aceitar', 'Aceitar o pedido pendente'],
      ['recusar', 'Recusar o pedido pendente'],
      ['divorcio', 'Terminar o relacionamento'],
      ['rep @pessoa', 'Dar 1 ponto de reputação'],
      ['unrep @pessoa', 'Tirar 1 ponto de reputação'],
      ['romance @pessoa', 'Medir o romance do casal'],
      ['beijo @pessoa', 'Mandar um beijo animado'],
      ['tapa @pessoa', 'Dar um tapa em alguém'],
      ['mamada @pessoa', 'Brincadeira interativa'],
      ['gozar', 'Expressar pura emoção'],
    ],
  },
  {
    emoji: '🎮',
    titulo: 'DIVERSÃO & JOGOS',
    comandos: [
      ['ship @pessoa1 @pessoa2', 'Calcular a afinidade do casal'],
      ['8ball <pergunta>', 'Perguntar à bola 8 mística'],
      ['taro', 'Tirar uma carta de tarô'],
      ['quiz', 'Responder uma pergunta de conhecimentos gerais'],
      ['forca', 'Jogar o jogo da forca'],
      ['roleta', 'Roleta russa em grupo'],
      ['ppt <pedra|papel|tesoura>', 'Jogar pedra, papel e tesoura'],
      ['dado', 'Rolar um dado de 6 lados'],
      ['caraoucoroa <cara|coroa>', 'Jogar cara ou coroa'],
      ['gay / corno / feio / chato', 'Medidores de zueira'],
      ['gostoso / bebado / sortudo', 'Mais medidores de zueira'],
    ],
  },
  {
    emoji: '🛡️',
    titulo: 'ADMINISTRAÇÃO DO GRUPO',
    comandos: [
      ['ban / kick @pessoa', 'Remover um membro do grupo'],
      ['promote @pessoa', 'Promover a administrador'],
      ['demote @pessoa', 'Rebaixar um administrador'],
      ['tagall <aviso>', 'Marcar todos os membros'],
      ['mute / unmute', 'Fechar ou abrir o grupo'],
      ['antilink <on|off>', 'Bloquear links de outros sites'],
      ['antispam <on|off>', 'Bloquear flood e spam'],
      ['boasvindas <on|off>', 'Avisar quando alguém entrar'],
      ['regras', 'Ver ou definir as regras do grupo'],
      ['warn @pessoa', 'Aplicar uma advertência'],
      ['warnings @pessoa', 'Consultar as advertências'],
      ['enquete <título|opção1|opção2>', 'Criar uma enquete votável'],
      ['ticket <motivo>', 'Abrir um chamado com a administração'],
      ['antidel <on|off>', 'Apagar mensagens deletadas (dono)'],
      ['adm @pessoa', 'Autorizar alguém a usar o /ver (dono)'],
      ['remover @pessoa', 'Tirar essa autorização (dono)'],
    ],
  },
  {
    emoji: '⚙️',
    titulo: 'UTILIDADES & INFORMAÇÕES',
    comandos: [
      ['menu', 'Abrir este menu novamente'],
      ['qrcode <texto ou link>', 'Gerar a imagem de um QR Code'],
      ['readqr', 'Ler o QR Code de uma imagem enviada'],
      ['cep <número>', 'Buscar o endereço de um CEP'],
      ['fila', 'Ver o status da fila de comandos'],
      ['ping', 'Medir o tempo de resposta'],
      ['uptime', 'Ver há quanto tempo o bot está online'],
      ['info (ou /botinfo)', 'Ver informações técnicas do bot'],
      ['grupo', 'Ver os detalhes do grupo atual'],
    ],
  },
];

/** Monta o menu completo. `prefixo` já entra em cada linha do comando. */
export function buildMenu({
  prefixo = '/',
  usuario = '',
  saudacao = '👋 Olá',
  velocidade = '0.003',
  uptime = '0s',
  ia = 'Qwen 3.8 27B (Groq)',
  nome = BOT_NAME,
} = {}) {
  const risco = '───────────────────────';
  const linhas = [
    `╭───「 ⚡ *${nome}* 」───`,
    '│',
    `│ ${saudacao}, *@${usuario}*!`,
    '│',
    `│ 👑 *Prefixo:* \`${prefixo}\``,
    `│ ⚡ *Resposta:* *${velocidade}s*`,
    `│ 🕒 *Online há:* *${uptime}*`,
    `│ 🧠 *IA:* ${ia}`,
    `╰${risco}`,
  ];

  for (const categoria of CATEGORIAS) {
    linhas.push('');
    linhas.push(`╭───「 ${categoria.emoji} *${categoria.titulo}* 」───`);
    for (const [usoCmd, descricao] of categoria.comandos) {
      linhas.push(`│ ◈ ${prefixo}${usoCmd} — ${descricao}`);
    }
    linhas.push(`╰${risco}`);
  }

  linhas.push('');
  linhas.push('💡 *Dica:* rode um comando sem argumentos para ver um exemplo de uso.');
  return linhas.join('\n');
}

/** Só os nomes de comando (primeira palavra) — usado em conferências. */
export function comandosDoMenu() {
  return CATEGORIAS.flatMap((c) => c.comandos.map(([usoCmd]) => usoCmd.split(' ')[0]));
}
