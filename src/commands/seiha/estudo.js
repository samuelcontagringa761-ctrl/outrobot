/**
 * /estudo e /redacao — o lado professora da Seiha.
 *
 * Reaproveita o /ia (Groq) com prompts próprios: um para explicar assuntos e
 * outro para corrigir redação no padrão ENEM.
 */

import { askAiChat } from '../../utils/aiService.js';
import { aviso, cabecalho, erro, info, uso } from '../../config/messages.js';

const PERSONA = 'Você é Seiha Shiunji, a segunda irmã da família Shiunji e aluna nota máxima. '
  + 'Fale em português do Brasil, com calma, clareza e precisão. '
  + 'Tom gentil e direto, sem bajulação e sem excesso de emoji. '
  + 'Use no máximo um emoji na resposta. Não use markdown com #, ** ou tabelas; '
  + 'para negrito do WhatsApp use apenas *asteriscos simples*. '
  + 'Nunca invente fontes, links ou dados que você não tenha.';

function limparSaida(texto) {
  return String(texto || '')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/```/g, '')
    .trim();
}

export async function handleEstudo(sock, msg, args, sender, from, prefix) {
  const tema = args.join(' ').trim();

  if (!tema) {
    return sock.sendMessage(from, {
      text: uso(`${prefix}estudo fotossíntese`, 'Serve para matérias da escola ou qualquer assunto que você queira entender.')
    }, { quoted: msg });
  }

  await sock.sendMessage(from, { text: '📚 Preparando a explicação, aguarde...' }, { quoted: msg });

  try {
    const resposta = await askAiChat([
      { role: 'system', content: PERSONA },
      {
        role: 'user',
        content: `Explique "${tema}" para alguém do ensino médio, em no máximo 1.200 caracteres.\n`
          + 'Siga exatamente este formato:\n'
          + 'Resumo: até 3 frases.\n'
          + 'Pontos principais: 3 tópicos começando com •.\n'
          + 'Para fixar: 2 perguntas curtas, numeradas.'
      }
    ], { max_tokens: 650, temperature: 0.4 });

    const texto = `${cabecalho('📚', `Estudo — ${tema.slice(0, 60)}`)}\n\n${limparSaida(resposta)}`;
    return sock.sendMessage(from, { text: texto }, { quoted: msg });
  } catch (err) {
    console.warn(`[estudo] ⚠️ Falha na IA: ${err.message}`);
    return sock.sendMessage(from, { text: erro('Não consegui montar a explicação agora. Tente novamente em instantes.') }, { quoted: msg });
  }
}

export async function handleRedacao(sock, msg, args, sender, from, prefix) {
  const texto = args.join(' ').trim();

  if (!texto) {
    return sock.sendMessage(from, {
      text: uso(`${prefix}redacao <texto da redação>`, 'Cole o texto inteiro. A correção segue as 5 competências do ENEM.')
    }, { quoted: msg });
  }

  if (texto.length < 150) {
    return sock.sendMessage(from, {
      text: aviso(`Texto muito curto (${texto.length} caracteres). Envie pelo menos 150 para eu conseguir avaliar.`)
    }, { quoted: msg });
  }

  if (texto.length > 6000) {
    return sock.sendMessage(from, {
      text: aviso(`Texto muito longo (${texto.length} caracteres). Envie até 6.000.`)
    }, { quoted: msg });
  }

  await sock.sendMessage(from, { text: '📝 Corrigindo a redação, aguarde...' }, { quoted: msg });

  try {
    const resposta = await askAiChat([
      { role: 'system', content: PERSONA + ' Você é corretora de redação e avalia com justiça, sem reescrever o texto do aluno.' },
      {
        role: 'user',
        content: 'Corrija a redação abaixo no padrão ENEM, em no máximo 1.400 caracteres.\n'
          + 'Formato obrigatório:\n'
          + 'Nota: X/1000\n'
          + 'Competência 1 (norma culta): nota e uma frase.\n'
          + 'Competência 2 (compreensão do tema): nota e uma frase.\n'
          + 'Competência 3 (argumentação): nota e uma frase.\n'
          + 'Competência 4 (coesão): nota e uma frase.\n'
          + 'Competência 5 (proposta de intervenção): nota e uma frase.\n'
          + 'Pontos fortes: 2 tópicos.\n'
          + 'O que melhorar: 2 tópicos específicos.\n\n'
          + `Redação:\n${texto}`
      }
    ], { max_tokens: 800, temperature: 0.4 });

    const corpo = `${cabecalho('📝', 'Redação — Correção')}\n\n${limparSaida(resposta)}\n\n` +
      info('Correção por IA: serve de estudo, não substitui a avaliação de um professor.');

    return sock.sendMessage(from, { text: corpo }, { quoted: msg });
  } catch (err) {
    console.warn(`[redacao] ⚠️ Falha na IA: ${err.message}`);
    return sock.sendMessage(from, { text: erro('Não consegui corrigir a redação agora. Tente novamente em instantes.') }, { quoted: msg });
  }
}
