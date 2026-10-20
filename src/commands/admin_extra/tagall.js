import { checkIfOwner, isAdmin } from '../admin.js';
import { grupoApenas, adminOuDonoApenas, cabecalho } from '../../config/messages.js';

export async function handleTagallCommand(sock, msg, args, sender) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  const groupMetadata = await sock.groupMetadata(from);
  const participants = groupMetadata.participants;

  if (!isAdmin(participants, sender) && !checkIfOwner(sender)) {
    return sock.sendMessage(from, { text: adminOuDonoApenas() }, { quoted: msg });
  }

  const messageText = args.join(' ') || 'Aviso geral para todos!';

  let text = `${cabecalho('📢', 'Chamada geral')}\n\nMensagem: ${messageText}\n\n`;
  const mentions = [];

  for (const p of participants) {
    text += `@${p.id.split('@')[0]}\n`;
    mentions.push(p.id);
  }

  return sock.sendMessage(from, { text, mentions }, { quoted: msg });
}
