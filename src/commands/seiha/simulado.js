/**
 * /simulado — 5 perguntas de escola por rodada.
 *
 * Cada acerto vale XP e moedas. Uma tentativa por pessoa em cada pergunta,
 * 90 segundos por pergunta. No fim, o primeiro lugar leva um bônus e a
 * sequência de dias de cada participante é atualizada.
 */

import { addXP, addBalance } from '../../database/sqlite.js';
import { aviso, cabecalho, info, sucesso } from '../../config/messages.js';
import {
  chaveDiaBR,
  lerJson,
  salvarJson,
  numeroDoJid
} from '../../utils/seihaStore.js';
import { BANCO_SIMULADO } from './simuladoData.js';

const TOTAL_PERGUNTAS = 5;
const SEGUNDOS_POR_PERGUNTA = 90;
const XP_POR_ACERTO = 30;
const MOEDAS_POR_ACERTO = 50;
const XP_BONUS_LIDER = 100;
const ARQUIVO_STATS = 'seiha_stats.json';

export const activeSimulados = new Map();

const normalizar = (texto) => String(texto || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

function embaralhar(lista) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Sorteia as perguntas e embaralha as opções de cada uma. */
function prepararPerguntas() {
  return embaralhar(BANCO_SIMULADO).slice(0, TOTAL_PERGUNTAS).map((original) => {
    const ordem = embaralhar(original.opcoes.map((_, indice) => indice));
    return {
      materia: original.materia,
      pergunta: original.pergunta,
      explicacao: original.explicacao,
      opcoes: ordem.map((indice) => original.opcoes[indice]),
      correta: ordem.indexOf(original.correta)
    };
  });
}

/** Converte "b", "2)" ou o texto de uma opção no índice escolhido. -1 se não for resposta. */
function identificarOpcao(resposta, pergunta) {
  const bruta = String(resposta || '').trim();

  const letra = bruta.match(/^([a-dA-D])(?:[).]|$)/);
  if (letra) return letra[1].toUpperCase().charCodeAt(0) - 65;

  const numero = bruta.match(/^([1-4])(?:[).]|$)/);
  if (numero) return Number(numero[1]) - 1;

  const alvo = normalizar(bruta);
  if (alvo.length < 2) return -1;

  return pergunta.opcoes.findIndex((opcao) => {
    const texto = normalizar(opcao);
    return texto === alvo || (alvo.length > 3 && (texto.includes(alvo) || alvo.includes(texto)));
  });
}

async function enviarPergunta(sock, from, estado) {
  const pergunta = estado.perguntas[estado.indice];
  if (!pergunta) return;

  estado.tentativas = new Set();
  estado.avancando = false;

  const letras = ['A', 'B', 'C', 'D'];
  const opcoes = pergunta.opcoes.map((opcao, indice) => `${letras[indice]}) ${opcao}`).join('\n');

  await sock.sendMessage(from, {
    text: `${cabecalho('📚', `Simulado — ${estado.indice + 1}/${estado.perguntas.length}`)}\n\n` +
      `*${pergunta.materia}*\n${pergunta.pergunta}\n\n${opcoes}\n\n` +
      info(`Responda com a letra ou o texto. Uma tentativa por pessoa, ${SEGUNDOS_POR_PERGUNTA} segundos.`)
  });

  estado.timer = setTimeout(() => {
    encerrarPorTempo(sock, from, estado).catch((err) => {
      console.warn(`[simulado] ⚠️ Falha no tempo esgotado: ${err.message}`);
    });
  }, SEGUNDOS_POR_PERGUNTA * 1000);
}

async function avancar(sock, from, estado) {
  if (estado.avancando) return;
  estado.avancando = true;

  try {
    estado.indice += 1;
    if (estado.indice >= estado.perguntas.length) {
      await finalizar(sock, from, estado);
    } else {
      await enviarPergunta(sock, from, estado);
    }
  } finally {
    estado.avancando = false;
  }
}

async function encerrarPorTempo(sock, from, estado) {
  if (estado.avancando) return;

  if (estado.timer) {
    clearTimeout(estado.timer);
    estado.timer = null;
  }

  const pergunta = estado.perguntas[estado.indice];
  if (!pergunta) return;

  const letra = ['A', 'B', 'C', 'D'][pergunta.correta];
  await sock.sendMessage(from, {
    text: `${aviso(`Tempo esgotado. Resposta: *${letra}) ${pergunta.opcoes[pergunta.correta]}*.`)}\n` +
      info(pergunta.explicacao)
  });

  await new Promise((resolve) => setTimeout(resolve, 1800));
  await avancar(sock, from, estado);
}

function atualizarEstatisticas(participantes, acertosPorJid) {
  const dados = lerJson(ARQUIVO_STATS, {});
  const hoje = chaveDiaBR();
  const ontem = chaveDiaBR(Date.now() - 86400000);

  for (const jid of participantes) {
    const atual = dados[jid] || { simulados: 0, acertos: 0, sequencia: 0, ultimoDia: null };

    if (atual.ultimoDia !== hoje) {
      atual.sequencia = atual.ultimoDia === ontem ? Number(atual.sequencia || 0) + 1 : 1;
      atual.ultimoDia = hoje;
    }

    atual.simulados = Number(atual.simulados || 0) + 1;
    atual.acertos = Number(atual.acertos || 0) + Number(acertosPorJid.get(jid) || 0);
    dados[jid] = atual;
  }

  salvarJson(ARQUIVO_STATS, dados);
  return dados;
}

async function finalizar(sock, from, estado) {
  if (estado.timer) {
    clearTimeout(estado.timer);
    estado.timer = null;
  }

  activeSimulados.delete(from);

  const participantes = [...estado.participantes];
  const ranking = [...estado.acertos.entries()].sort((a, b) => b[1] - a[1]);
  const stats = atualizarEstatisticas(participantes, estado.acertos);

  if (!ranking.length) {
    return sock.sendMessage(from, {
      text: `${cabecalho('🏁', 'Simulado encerrado')}\n\n` +
        info('Ninguém acertou desta vez. Use /simulado para tentar de novo.')
    });
  }

  const medalhas = ['🥇', '🥈', '🥉'];
  const linhas = ranking.map(([jid, acertos], indice) => {
    const posicao = medalhas[indice] || `${indice + 1}.`;
    return `${posicao} @${numeroDoJid(jid)} — *${acertos}/${estado.perguntas.length}*`;
  });

  const [lider, acertosDoLider] = ranking[0];

  if (acertosDoLider > 0) {
    try {
      await addXP(lider, XP_BONUS_LIDER);
    } catch (err) {
      console.warn(`[simulado] ⚠️ Falha ao dar o bônus: ${err.message}`);
    }
  }

  const sequencia = Number(stats[lider]?.sequencia || 1);

  const texto = `${cabecalho('🏁', 'Simulado encerrado')}\n\n` +
    `${linhas.join('\n')}\n\n` +
    (acertosDoLider > 0 ? `🎁 *+${XP_BONUS_LIDER} XP* de bônus para o primeiro lugar.\n` : '') +
    `🔥 @${numeroDoJid(lider)} está há *${sequencia} dia(s)* seguido(s) no simulado.`;

  return sock.sendMessage(from, {
    text: texto,
    mentions: ranking.map(([jid]) => jid)
  });
}

export async function handleSimulado(sock, msg, args, sender, from, isGroup) {
  const acao = (args[0] || '').toLowerCase();

  if (['cancelar', 'parar', 'sair'].includes(acao)) {
    const estado = activeSimulados.get(from);
    if (!estado) {
      return sock.sendMessage(from, { text: info('Nenhum simulado em andamento.') }, { quoted: msg });
    }

    if (estado.timer) clearTimeout(estado.timer);
    activeSimulados.delete(from);
    return sock.sendMessage(from, { text: info('Simulado cancelado.') }, { quoted: msg });
  }

  if (activeSimulados.has(from)) {
    return sock.sendMessage(from, {
      text: info('Já existe um simulado em andamento. Responda a pergunta atual ou use `/simulado cancelar`.')
    }, { quoted: msg });
  }

  const estado = {
    perguntas: prepararPerguntas(),
    indice: 0,
    tentativas: new Set(),
    participantes: new Set(),
    acertos: new Map(),
    timer: null,
    avancando: false
  };

  activeSimulados.set(from, estado);

  await sock.sendMessage(from, {
    text: `${cabecalho('📚', 'Simulado começando')}\n\n` +
      `${TOTAL_PERGUNTAS} perguntas de escola. Cada acerto vale *+${XP_POR_ACERTO} XP* e *+$${MOEDAS_POR_ACERTO}*.\n` +
      info('Uma tentativa por pessoa em cada pergunta.')
  }, { quoted: msg });

  await enviarPergunta(sock, from, estado);
  return true;
}

/** Chamado para cada mensagem de texto quando há simulado ativo no chat. */
export async function processSimuladoAnswer(sock, msg, from, resposta, sender) {
  const estado = activeSimulados.get(from);
  if (!estado) return false;

  const pergunta = estado.perguntas[estado.indice];
  if (!pergunta) return false;

  const escolha = identificarOpcao(resposta, pergunta);
  if (escolha < 0 || escolha > 3) return false;

  estado.participantes.add(sender);

  if (estado.tentativas.has(sender)) {
    await sock.sendMessage(from, {
      text: aviso(`@${numeroDoJid(sender)}, você já tentou esta pergunta.`),
      mentions: [sender]
    }, { quoted: msg });
    return true;
  }

  estado.tentativas.add(sender);

  if (escolha !== pergunta.correta) {
    await sock.sendMessage(from, {
      text: aviso(`@${numeroDoJid(sender)}, não é essa. Aguarde a próxima.`),
      mentions: [sender]
    }, { quoted: msg });
    return true;
  }

  if (estado.timer) {
    clearTimeout(estado.timer);
    estado.timer = null;
  }

  const acertos = Number(estado.acertos.get(sender) || 0) + 1;
  estado.acertos.set(sender, acertos);

  try {
    await addXP(sender, XP_POR_ACERTO);
    await addBalance(sender, MOEDAS_POR_ACERTO);
  } catch (err) {
    console.warn(`[simulado] ⚠️ Falha ao premiar ${numeroDoJid(sender)}: ${err.message}`);
  }

  const letra = ['A', 'B', 'C', 'D'][pergunta.correta];
  await sock.sendMessage(from, {
    text: `${sucesso(`@${numeroDoJid(sender)} acertou! Resposta: *${letra}) ${pergunta.opcoes[pergunta.correta]}*.`)}\n\n` +
      `ℹ️ ${pergunta.explicacao}\n` +
      `🎁 *+${XP_POR_ACERTO} XP* e *+$${MOEDAS_POR_ACERTO}*.`,
    mentions: [sender]
  }, { quoted: msg });

  await new Promise((resolve) => setTimeout(resolve, 1800));
  await avancar(sock, from, estado);
  return true;
}
