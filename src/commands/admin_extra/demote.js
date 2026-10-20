import { checkIfOwner, isAdmin, isBotAdmin, resolveActionTarget } from '../admin.js';
import { grupoApenas, adminOuDonoApenas, botPrecisaAdmin, marcaAlguem, alvoNaoEncontrado, erro } from '../../config/messages.js';

export async function handleDemoteCommand(sock, msg, args, sender, mentioned) {
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

  try {
    await sock.groupParticipantsUpdate(from, [resolved.actionJid], 'demote');
    return sock.sendMessage(from, { text: `🛡️ @${resolved.actionJid.split('@')[0]} teve o cargo de administrador removido.`, mentions: [resolved.actionJid] }, { quoted: msg });
  } catch (err) {
    return sock.sendMessage(from, { text: erro('Não foi possível rebaixar o participante.') }, { quoted: msg });
  }
}
