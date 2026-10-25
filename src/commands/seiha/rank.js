/**
 * /rank — quadro de honra da Seiha.
 *
 * Usa os rankings que já existem no banco (XP, moedas e aura). Sem comando
 * novo de banco, sem tabela nova.
 */

import {
  getTopUsersByXP,
  getTopUsersByWallet,
  getTopUsersByAura
} from '../../database/sqlite.js';
import { aviso, cabecalho, info, uso } from '../../config/messages.js';
import { numeroDoJid } from '../../utils/seihaStore.js';

const MEDALHAS = ['🥇', '🥈', '🥉'];
const LIMITE = 8;

const TIPOS = {
  xp: { rotulo: 'XP', valor: (u) => `${Number(u.xp || 0).toLocaleString('pt-BR')} XP (Nv. ${Number(u.level || 1)})`, lista: () => getTopUsersByXP(1000), filtro: (u) => Number(u.xp || 0) > 0 },
  moedas: { rotulo: 'MOEDAS', valor: (u) => `$${Number((u.wallet || 0) + (u.bank || 0)).toLocaleString('pt-BR')}`, lista: () => getTopUsersByWallet(1000), filtro: (u) => Number((u.wallet || 0) + (u.bank || 0)) > 0 },
  aura: { rotulo: 'AURA', valor: (u) => `${Number(u.aura || 0).toLocaleString('pt-BR')} de aura`, lista: () => getTopUsersByAura(1000), filtro: (u) => Number(u.aura || 0) > 0 }
};

const ALIASES = {
  xp: 'xp', nivel: 'xp', 'nível': 'xp', level: 'xp',
  moedas: 'moedas', moeda: 'moedas', dinheiro: 'moedas', saldo: 'moedas', wallet: 'moedas',
  aura: 'aura', auras: 'aura'
};

async function numerosDoGrupo(sock, from) {
  try {
    const meta = await sock.groupMetadata(from);
    return new Set((meta.participants || []).map((p) => numeroDoJid(p.id)));
  } catch (err) {
    console.warn(`[rank] ⚠️ Não consegui ler o grupo: ${err.message}`);
    return null;
  }
}

export async function handleRank(sock, msg, args, sender, from, isGroup, prefix) {
  const palavras = args.map((a) => String(a).toLowerCase());
  const querGrupo = palavras.includes('grupo') || palavras.includes('group');
  const pedido = palavras.find((p) => p && p !== 'grupo' && p !== 'group');

  if (pedido && !ALIASES[pedido]) {
    return sock.sendMessage(from, {
      text: uso(`${prefix}rank [xp|moedas|aura]`, 'Acrescente *grupo* para considerar só este grupo.')
    }, { quoted: msg });
  }

  const tipo = TIPOS[ALIASES[pedido] || 'xp'];
  let lista = tipo.lista().filter(tipo.filtro);
  let escopo = 'global';

  if (querGrupo) {
    if (!isGroup) return sock.sendMessage(from, { text: aviso('O ranking por grupo só funciona dentro de um grupo.') }, { quoted: msg });

    const numeros = await numerosDoGrupo(sock, from);
    if (!numeros) {
      return sock.sendMessage(from, { text: aviso('Não consegui ler os participantes do grupo agora.') }, { quoted: msg });
    }

    lista = lista.filter((u) => numeros.has(numeroDoJid(u.jid)));
    escopo = 'do grupo';
  }

  if (!lista.length) {
    return sock.sendMessage(from, {
      text: `${cabecalho('🏆', `Quadro de Honra — ${tipo.rotulo}`)}\n\n${info('Ninguém pontuou ainda. Use os comandos de jogo e estudo para começar.')}`
    }, { quoted: msg });
  }

  const topo = lista.slice(0, LIMITE);
  const linhas = topo.map((u, indice) => {
    const posicao = MEDALHAS[indice] || `${indice + 1}.`;
    return `${posicao} *${numeroDoJid(u.jid)}* — ${tipo.valor(u)}`;
  });

  const posicaoDoAutor = lista.findIndex((u) => numeroDoJid(u.jid) === numeroDoJid(sender));
  if (posicaoDoAutor >= LIMITE) {
    linhas.push('', `Você: *${posicaoDoAutor + 1}º* — ${tipo.valor(lista[posicaoDoAutor])}`);
  }

  const texto = `${cabecalho('🏆', `Quadro de Honra — ${tipo.rotulo}`)}\n\n` +
    `Escopo: *${escopo}* · ${lista.length} pessoa(s) pontuando.\n\n` +
    linhas.join('\n');

  return sock.sendMessage(from, { text: texto }, { quoted: msg });
}
