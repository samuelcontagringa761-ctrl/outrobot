import { checkIfOwner, isAdmin, isBotAdmin, isBotJid, isPhoneJid, resolveActionTarget } from '../admin.js';
import { grupoApenas, adminOuDonoApenas, botPrecisaAdmin, marcaAlguem, alvoNaoEncontrado, aviso, erro } from '../../config/messages.js';

export async function handleKickCommand(sock, msg, args, sender, mentioned) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  const groupMetadata = await sock.groupMetadata(from);
  const participants = groupMetadata.participants;

  if (!isAdmin(participants, sender) && !checkIfOwner(sender)) {
    return sock.sendMessage(from, { text: adminOuDonoApenas() }, { quoted: msg });
  }

  if (!isBotAdmin(participants, sock)) {
    return sock.sendMessage(from, { text: botPrecisaAdmin() }, { quoted: msg });
  }

  let target = mentioned[0] || msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (!target) {
    return sock.sendMessage(from, { text: marcaAlguem() }, { quoted: msg });
  }

  const resolved = resolveActionTarget(groupMetadata, target);
  if (!resolved) {
    return sock.sendMessage(from, { text: alvoNaoEncontrado() }, { quoted: msg });
  }
  const actionJid = resolved.actionJid;

  if (isBotJid(sock, target)) {
    return sock.sendMessage(from, { text: aviso('Eu não posso me expulsar!') }, { quoted: msg });
  }

  if (isPhoneJid(target) && checkIfOwner(target)) {
    return sock.sendMessage(from, { text: aviso('Não posso expulsar o meu dono!') }, { quoted: msg });
  }

  try {
    if (isAdmin(participants, target)) {
      await sock.groupParticipantsUpdate(from, [actionJid], 'demote');
    }
    await sock.groupParticipantsUpdate(from, [actionJid], 'remove');
    return sock.sendMessage(from, { text: `🚪 @${actionJid.split('@')[0]} foi expulso do grupo.`, mentions: [actionJid] }, { quoted: msg });
  } catch (err) {
    return sock.sendMessage(from, { text: erro('Não foi possível remover o participante.') }, { quoted: msg });
  }
}
