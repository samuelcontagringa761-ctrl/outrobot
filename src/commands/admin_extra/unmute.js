import { checkIfOwner, isAdmin } from '../admin.js';
import { grupoApenas, adminApenas, erro } from '../../config/messages.js';

export async function handleUnmuteCommand(sock, msg, args, sender) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  const groupMetadata = await sock.groupMetadata(from);
  const participants = groupMetadata.participants;

  if (!isAdmin(participants, sender) && !checkIfOwner(sender)) {
    return sock.sendMessage(from, { text: adminApenas() }, { quoted: msg });
  }

  try {
    await sock.groupSettingUpdate(from, 'not_announcement');
    return sock.sendMessage(from, { text: '🔓 *Grupo aberto!* Agora todos os membros podem enviar mensagens.' }, { quoted: msg });
  } catch (err) {
    return sock.sendMessage(from, { text: erro('Não foi possível abrir o grupo. Verifique se o bot é administrador.') }, { quoted: msg });
  }
}
