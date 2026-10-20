import { checkIfOwner, isAdmin, isBotAdmin, isPhoneJid, resolveActionTarget } from '../admin.js';
import { addWarn, getWarns, resetWarns } from '../../database/sqlite.js';
import { grupoApenas, adminOuDonoApenas, marcaAlguem, aviso, sucesso, linha } from '../../config/messages.js';

export async function handleWarnCommand(sock, msg, args, sender, mentioned) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  const groupMetadata = await sock.groupMetadata(from);
  const participants = groupMetadata.participants;

  if (!isAdmin(participants, sender) && !checkIfOwner(sender)) {
    return sock.sendMessage(from, { text: adminOuDonoApenas() }, { quoted: msg });
  }

  let target = mentioned[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (!target) {
    return sock.sendMessage(from, { text: marcaAlguem() }, { quoted: msg });
  }

  if (isPhoneJid(target) && checkIfOwner(target)) {
    return sock.sendMessage(from, { text: aviso('Não é possível advertir o dono do bot!') }, { quoted: msg });
  }

  const count = addWarn(from, target);
  const MAX_WARNS = 3;

  if (count >= MAX_WARNS) {
    resetWarns(from, target);
    const resolved = resolveActionTarget(groupMetadata, target);
    const actionJid = resolved?.actionJid || target;
    if (isBotAdmin(participants, sock) && resolved) {
      try {
        if (isAdmin(participants, target)) {
          await sock.groupParticipantsUpdate(from, [actionJid], 'demote');
        }
        await sock.groupParticipantsUpdate(from, [actionJid], 'remove');
        return sock.sendMessage(from, { 
          text: sucesso(`@${actionJid.split('@')[0]} atingiu *${MAX_WARNS}/${MAX_WARNS}* advertências e foi removido do grupo.`),
          mentions: [actionJid]
        }, { quoted: msg });
      } catch (err) {
        console.error('Erro ao remover membro com max advertências:', err);
      }
    }
    return sock.sendMessage(from, { 
      text: aviso(`@${target.split('@')[0]} atingiu *${MAX_WARNS}/${MAX_WARNS}* advertências, mas não tenho permissão para removê-lo.`),
      mentions: [target]
    }, { quoted: msg });
  }

  return sock.sendMessage(from, { 
    text: `${sucesso(`@${target.split('@')[0]} recebeu uma advertência.`)}\n\n${linha('Total', `${count}/${MAX_WARNS}`)}`,
    mentions: [target]
  }, { quoted: msg });
}
