/**
 * /familia — a família Shiunji do grupo.
 *
 * A Seiha é a segunda irmã; os membros do grupo ocupam os outros seis papéis
 * da família. A adesão é opcional: ninguém entra sem rodar /familia entrar.
 */

import { getUser } from '../../database/sqlite.js';
import { aviso, cabecalho, info, sucesso } from '../../config/messages.js';
import { lerJson, salvarJson, numeroDoJid } from '../../utils/seihaStore.js';

const ARQUIVO = 'seiha_familia.json';

export const PAPEIS = [
  { id: 'banri', nome: 'Banri', titulo: 'irmã mais velha', emoji: '🌸' },
  { id: 'arata', nome: 'Arata', titulo: 'irmão do meio', emoji: '📚' },
  { id: 'ouka', nome: 'Ouka', titulo: 'irmã do meio', emoji: '✨' },
  { id: 'minami', nome: 'Minami', titulo: 'quarta irmã', emoji: '🎾' },
  { id: 'shion', nome: 'Shion', titulo: 'irmão caçula', emoji: '🧢' },
  { id: 'kotono', nome: 'Kotono', titulo: 'caçula', emoji: '🍡' }
];

const porId = new Map(PAPEIS.map((p) => [p.id, p]));

function dadosDaFamilia() {
  return lerJson(ARQUIVO, {});
}

function membrosDoGrupo(dados, from) {
  if (!dados[from] || typeof dados[from].membros !== 'object') {
    dados[from] = { membros: {} };
  }
  return dados[from].membros;
}

function descreverPapel(id) {
  const papel = porId.get(id);
  if (!papel) return 'agregado da família';
  return `${papel.nome}, ${papel.titulo}`;
}

export async function handleFamilia(sock, msg, args, sender, from, isGroup, prefix) {
  if (!isGroup) {
    return sock.sendMessage(from, { text: aviso('A família Shiunji existe dentro de um grupo.') }, { quoted: msg });
  }

  const dados = dadosDaFamilia();
  const membros = membrosDoGrupo(dados, from);
  const acao = (args[0] || '').toLowerCase();

  if (['entrar', 'join', 'adotar'].includes(acao)) {
    if (membros[sender]) {
      return sock.sendMessage(from, {
        text: info(`Você já é *${descreverPapel(membros[sender].papel)}* nesta família.`)
      }, { quoted: msg });
    }

    const ocupados = new Set(Object.values(membros).map((m) => m.papel));
    const livre = PAPEIS.find((p) => !ocupados.has(p.id));
    const papel = livre ? livre.id : 'agregado';

    membros[sender] = { papel, entrouEm: Date.now() };
    salvarJson(ARQUIVO, dados);

    const texto = livre
      ? sucesso(`@${numeroDoJid(sender)} entrou na família como *${livre.nome}*, ${livre.titulo}.`)
      : info(`@${numeroDoJid(sender)} entrou como *agregado*: todos os papéis já estão ocupados.`);

    return sock.sendMessage(from, { text: texto, mentions: [sender] }, { quoted: msg });
  }

  if (['sair', 'leave', 'sai'].includes(acao)) {
    if (!membros[sender]) {
      return sock.sendMessage(from, { text: info('Você não está na família deste grupo.') }, { quoted: msg });
    }

    const papel = membros[sender].papel;
    delete membros[sender];
    salvarJson(ARQUIVO, dados);

    return sock.sendMessage(from, {
      text: sucesso(`@${numeroDoJid(sender)} saiu da família. O papel de *${descreverPapel(papel)}* ficou vago.`),
      mentions: [sender]
    }, { quoted: msg });
  }

  const porPapel = new Map(Object.entries(membros).map(([jid, m]) => [m.papel, jid]));
  const linhas = [cabecalho('🏠', 'Família Shiunji'), '', '👑 *Seiha* — segunda irmã (bot)'];

  for (const papel of PAPEIS) {
    const jid = porPapel.get(papel.id);
    const pessoa = jid
      ? `@${numeroDoJid(jid)} (Nv. ${Number(getUser(jid)?.level || 1)})`
      : '_vago_';
    linhas.push(`${papel.emoji} *${papel.nome}* — ${papel.titulo}: ${pessoa}`);
  }

  const agregados = Object.entries(membros).filter(([, m]) => m.papel === 'agregado');
  if (agregados.length) {
    linhas.push('', `🍃 *Agregados:* ${agregados.map(([jid]) => `@${numeroDoJid(jid)}`).join(', ')}`);
  }

  if (!Object.keys(membros).length) {
    linhas.push('', info(`Ninguém entrou ainda. Use \`${prefix}familia entrar\` para ocupar um papel.`));
  } else {
    linhas.push('', info(`Papéis vagos podem ser ocupados com \`${prefix}familia entrar\`.`));
  }

  return sock.sendMessage(from, {
    text: linhas.join('\n'),
    mentions: Object.keys(membros)
  }, { quoted: msg });
}
