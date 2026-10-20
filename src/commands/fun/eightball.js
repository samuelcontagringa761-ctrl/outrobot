import { askAi } from '../../utils/aiService.js';
import { uso, cabecalho, linha } from '../../config/messages.js';

export async function handleEightBallCommand(sock, msg, args) {
  const from = msg.key.remoteJid;
  const question = args.join(' ').trim();

  if (!question) {
    return sock.sendMessage(from, { text: uso('/8ball Eu vou ficar rico este ano?', 'Faça uma pergunta para a Bola 8 Mágica.') }, { quoted: msg });
  }

  await sock.sendMessage(from, { text: '🎱 Consultando a névoa do destino...' }, { quoted: msg });

  const systemInstruction = 'Você é a mística Bola 8 Mágica (Magic 8-Ball) em um bot de WhatsApp. Responda à pergunta do usuário de forma curta, enigmática, divertida e mística, mantendo o tom clássico e misterioso da Bola 8 Mágica. Responda em no máximo 1 ou 2 frases curtas.';
  const prompt = `Pergunta do usuário: "${question}"`;

  try {
    const aiAnswer = await askAi(prompt, systemInstruction);
    return sock.sendMessage(from, {
      text: `${cabecalho('🎱', 'Bola 8 Mágica de IA')}\n\n` +
            `${linha('Pergunta', question)}\n` +
            `🔮 Resposta: ${aiAnswer}`
    }, { quoted: msg });
  } catch (err) {
    console.error('Erro no comando /8ball:', err.message);
    const fallbackResponses = [
      'Com certeza!', 'Decididamente sim.', 'Sem dúvidas.', 'Sinais apontam que sim.',
      'Resposta nebulosa, tente de novo.', 'Pergunte novamente mais tarde.', 'Não conte com isso.', 'Minhas fontes dizem não.'
    ];
    const fallbackAnswer = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    return sock.sendMessage(from, {
      text: `${cabecalho('🎱', 'Bola 8 Mágica')}\n\n` +
            `${linha('Pergunta', question)}\n` +
            `🔮 Resposta: ${fallbackAnswer}`
    }, { quoted: msg });
  }
}
