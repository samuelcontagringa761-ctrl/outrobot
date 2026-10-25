/**
 * /heranca — disputa mensal de XP dentro do grupo.
 *
 * O primeiro uso do mês guarda o XP de cada membro como ponto de partida.
 * Quando o mês vira, quem mais ganhou XP leva moedas e aura, e a disputa
 * recomeça automaticamente.
 */

import { addAura, addBalance, getStore } from '../../database/sqlite.js';
import { aviso, cabecalho, info } from '../../config/messages.js';
import {
  chaveMesBR,
  dataBR,
  lerJson,
  salvarJson,
  nomeDoMes,
  numeroDoJid
} from '../../utils/seihaStore.js';

const ARQUIVO = 'seiha_heranca.json';
const PREMIO_MOEDAS = 2000;
const PREMIO_AURA = 50;
const MAX_HISTORICO = 6;

function chaveReal(store, jid) {
  if (store.users?.[jid]) return jid;
  const numero = numeroDoJid(jid);
  return Object.keys(store.users || {}).find((chave) => numeroDoJid(chave) === numero) || jid;
}

function xpDe(store, jid) {
  return Number(store.users?.[chaveReal(store, jid)]?.xp || 0);
}

function fotografarXp(participantes) {
  const store = getStore();
  const base = {};
  for (const jid of participantes) {
    base[numeroDoJid(jid)] = xpDe(store, jid);
  }
  return base;
}

function ganhosDoMes(participantes, base) {
  const store = getStore();
  return participantes
    .map((jid) => {
      const atual = xpDe(store, jid);
      const inicio = Number(base[numeroDoJid(jid)] ?? atual);
      return { jid, ganho: atual - inicio };
    })
    .filter((item) => item.ganho > 0)
    .sort((a, b) => b.ganho - a.ganho);
}

async function participantesDoGrupo(sock, from) {
  try {
    const meta = await sock.groupMetadata(from);
    return [...new Set((meta.participants || []).map((p) => p.id))];
  } catch (err) {
    console.warn(`[heranca] ⚠️ Não consegui ler o grupo: ${err.message}`);
    return null;
  }
}

function diasRestantesNoMes() {
  const agora = dataBR();
  const ultimoDia = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.max(0, ultimoDia - agora.getUTCDate());
}

export async function handleHeranca(sock, msg, args, sender, from, isGroup, prefix) {
  if (!isGroup) {
    return sock.sendMessage(from, { text: aviso('A herança é disputada dentro de um grupo.') }, { quoted: msg });
  }

  const dados = lerJson(ARQUIVO, {});
  const participantes = await participantesDoGrupo(sock, from);
  if (!participantes) {
    return sock.sendMessage(from, { text: aviso('Não consegui ler os participantes do grupo agora.') }, { quoted: msg });
  }

  if ((args[0] || '').toLowerCase() === 'historico') {
    const historico = dados[from]?.historico || [];
    if (!historico.length) {
      return sock.sendMessage(from, {
        text: info('A herança ainda não teve nenhum vencedor. A disputa atual está em andamento.')
      }, { quoted: msg });
    }

    const linhas = historico.map((item) => {
      const [ano, mes] = String(item.mes).split('-');
      return `• ${nomeDoMes(Number(mes))}/${ano}: *${item.vencedor}* — +${Number(item.ganho || 0).toLocaleString('pt-BR')} XP`;
    });

    return sock.sendMessage(from, {
      text: `${cabecalho('🏛️', 'Herança — histórico')}\n\n${linhas.join('\n')}`
    }, { quoted: msg });
  }

  const mesAtual = chaveMesBR();
  const [anoAtual, numeroDoMesAtual] = mesAtual.split('-').map(Number);

  // Primeiro uso do grupo: só abre a disputa, sem vencedor.
  if (!dados[from] || !dados[from].base) {
    dados[from] = {
      mes: mesAtual,
      base: fotografarXp(participantes),
      historico: dados[from]?.historico || []
    };
    salvarJson(ARQUIVO, dados);

    return sock.sendMessage(from, {
      text: `${cabecalho('🏛️', `Herança da família — ${nomeDoMes(numeroDoMesAtual)}`)}\n\n` +
        'A disputa começou agora: o XP de cada um passa a contar.\n' +
        `🎁 No fim do mês, quem mais ganhar XP leva *$${PREMIO_MOEDAS.toLocaleString('pt-BR')}* e *+${PREMIO_AURA} de aura*.`
    }, { quoted: msg });
  }

  const estado = dados[from];

  // O mês virou: fecha a disputa anterior e abre a nova.
  if (estado.mes !== mesAtual) {
    const ganhos = ganhosDoMes(participantes, estado.base);
    const vencedor = ganhos[0] || null;
    const [anoAnterior, numeroDoMesAnterior] = String(estado.mes).split('-').map(Number);

    let premio = '';
    if (vencedor) {
      try {
        const chave = chaveReal(getStore(), vencedor.jid);
        await addBalance(chave, PREMIO_MOEDAS);
        await addAura(chave, PREMIO_AURA);
        premio = `🎁 Prêmio: *$${PREMIO_MOEDAS.toLocaleString('pt-BR')}* e *+${PREMIO_AURA} de aura*.\n`;
      } catch (err) {
        console.warn(`[heranca] ⚠️ Falha ao premiar ${numeroDoJid(vencedor.jid)}: ${err.message}`);
      }
    }

    estado.historico = [
      ...(estado.historico || []),
      ...(vencedor ? [{ mes: estado.mes, vencedor: numeroDoJid(vencedor.jid), ganho: vencedor.ganho }] : [])
    ].slice(-MAX_HISTORICO);

    estado.mes = mesAtual;
    estado.base = fotografarXp(participantes);
    salvarJson(ARQUIVO, dados);

    const fechamento = vencedor
      ? `${cabecalho('🏛️', `Herança de ${nomeDoMes(numeroDoMesAnterior)}/${anoAnterior}`)}\n\n` +
        `Vencedor: *@${numeroDoJid(vencedor.jid)}* com *+${vencedor.ganho.toLocaleString('pt-BR')} XP*.\n` +
        premio +
        `\n🏁 *Nova disputa: ${nomeDoMes(numeroDoMesAtual)}.* O XP de todos recomeça a contar agora.`
      : `${cabecalho('🏛️', `Herança de ${nomeDoMes(numeroDoMesAnterior)}/${anoAnterior}`)}\n\n` +
        'Ninguém ganhou XP no mês passado, então a herança ficou sem dono.\n\n' +
        `🏁 *Nova disputa: ${nomeDoMes(numeroDoMesAtual)}.*`;

    return sock.sendMessage(from, {
      text: fechamento,
      mentions: vencedor ? [vencedor.jid] : []
    }, { quoted: msg });
  }

  // Mesmo mês: mostra a parcial.
  const ganhos = ganhosDoMes(participantes, estado.base);
  if (!ganhos.length) {
    return sock.sendMessage(from, {
      text: `${cabecalho('🏛️', `Herança da família — ${nomeDoMes(numeroDoMesAtual)}`)}\n\n` +
        info('Ninguém ganhou XP ainda neste mês. Use os comandos de jogo e estudo para pontuar.')
    }, { quoted: msg });
  }

  const medalhas = ['🥇', '🥈', '🥉'];
  const linhas = ganhos.slice(0, 8).map((item, indice) => {
    const posicao = medalhas[indice] || `${indice + 1}.`;
    return `${posicao} *${numeroDoJid(item.jid)}* — +${item.ganho.toLocaleString('pt-BR')} XP`;
  });

  const restantes = diasRestantesNoMes();

  return sock.sendMessage(from, {
    text: `${cabecalho('🏛️', `Herança da família — ${nomeDoMes(numeroDoMesAtual)}`)}\n\n` +
      `${linhas.join('\n')}\n\n` +
      `🎁 Prêmio: *$${PREMIO_MOEDAS.toLocaleString('pt-BR')}* e *+${PREMIO_AURA} de aura*.\n` +
      `⏳ ${restantes === 0 ? 'Último dia da disputa.' : `Faltam *${restantes} dia(s)*.`}`
  }, { quoted: msg });
}
