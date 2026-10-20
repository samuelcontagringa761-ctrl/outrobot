import { checkIfOwner, isAdmin } from '../admin.js';
import { getGroupConfig, updateGroupConfig } from '../../database/sqlite.js';
import { grupoApenas, adminApenas, cabecalho } from '../../config/messages.js';

export async function handleRegrasCommand(sock, msg, args, sender) {
  const from = msg.key.remoteJid;
  if (!from.endsWith('@g.us')) {
    return sock.sendMessage(from, { text: grupoApenas() }, { quoted: msg });
  }

  const groupConfig = getGroupConfig(from);

  // Se passou texto e for admin, atualiza as regras
  if (args.length > 0) {
    const groupMetadata = await sock.groupMetadata(from);
    const participants = groupMetadata.participants;

    if (!isAdmin(participants, sender) && !checkIfOwner(sender)) {
      return sock.sendMessage(from, { text: adminApenas() }, { quoted: msg });
    }

    const newRules = args.join(' ');
    updateGroupConfig(from, { rules: newRules });
    return sock.sendMessage(from, { text: '📜 Regras do grupo atualizadas.' }, { quoted: msg });
  }

  // Caso contrário, exibe as regras
  const rules = groupConfig.rules || 'Nenhuma regra definida ainda. Administradores usam `/regras <texto>` para definir.';
  return sock.sendMessage(from, { text: `${cabecalho('📜', 'Regras do grupo')}\n\n${rules}` }, { quoted: msg });
}
