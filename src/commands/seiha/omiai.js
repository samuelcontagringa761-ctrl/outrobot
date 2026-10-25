/**
 * /omiai — encontro arranjado no estilo da família Shiunji.
 *
 * É simbólico: calcula uma compatibilidade estável e pede para a IA escrever
 * uma carta curta de apresentação. Não mexe no sistema de casamento (/casar).
 */

import { askAiChat } from '../../utils/aiService.js';
import { cabecalho, info, marcaAlguem } from '../../config/messages.js';
import { numeroDoJid } from '../../utils/seihaStore.js';

function assinatura(a, b) {
  const texto = [a, b].sort().join('|');
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function veredito(percentual) {
  if (percentual >= 85) return 'A família aprovaria na hora.';
  if (percentual >= 70) return 'Há química suficiente para um segundo encontro.';
  if (percentual >= 55) return 'Começa como amizade, com chance de crescer.';
  return 'Melhor irem devagar: amizade primeiro.';
}

const CARTA_RESERVA = 'Apresento-me com respeito e a esperança de um encontro tranquilo. '
  + 'A família me ensinou a valorizar a sinceridade e a paciência. '
  + 'Se houver espaço para conversarmos, ficarei grato.';

export async function handleOmiai(sock, msg, args, sender, mentioned, from, prefix) {
  const alvo = (mentioned || []).find((jid) => jid !== sender);

  if (!alvo) {
    return sock.sendMessage(from, { text: marcaAlguem() }, { quoted: msg });
  }

  const percentual = 40 + (assinatura(sender, alvo) % 61);
  const de = numeroDoJid(sender);
  const para = numeroDoJid(alvo);

  let carta = CARTA_RESERVA;
  try {
    const resposta = await askAiChat([
      {
        role: 'system',
        content: 'Você é Seiha Shiunji, a segunda irmã da família Shiunji. Escreva em português do Brasil. '
          + 'Tom formal, gentil e reservado, sem emojis e sem bajulação. Não invente dados pessoais, idade, profissão ou aparência.'
      },
      {
        role: 'user',
        content: `Escreva uma carta curta de apresentação para um omiai (encontro arranjado) de ${de} para ${para}. `
          + 'Três a cinco frases, no máximo 500 caracteres. Fale sobre respeito, família e a possibilidade de se conhecerem.'
      }
    ], { max_tokens: 300, temperature: 0.7 });

    const limpa = String(resposta || '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/^["“]|["”]$/g, '')
      .trim();

    if (limpa.length >= 40) carta = limpa;
  } catch (err) {
    console.warn(`[omiai] ⚠️ IA indisponível, usando carta padrão: ${err.message}`);
  }

  const texto = `${cabecalho('🏠', 'Omiai — Seiha')}\n\n` +
    `De: *@${de}* → Para: *@${para}*\n` +
    `Compatibilidade: *${percentual}%*\n` +
    `${veredito(percentual)}\n\n` +
    `"${carta}"\n\n` +
    info(`Encontro simbólico. Para um pedido real, use \`${prefix}casar @pessoa\`.`);

  return sock.sendMessage(from, {
    text: texto,
    mentions: [sender, alvo]
  }, { quoted: msg });
}
