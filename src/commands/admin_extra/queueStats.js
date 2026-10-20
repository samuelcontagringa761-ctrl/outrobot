import queueManager from '../../queue/QueueManager.js';
import { cabecalho, linha } from '../../config/messages.js';

export async function handleQueueStatsCommand(sock, msg) {
  const from = msg.key.remoteJid;
  const stats = queueManager.getStats();

  const text = `${cabecalho('📊', 'Queue status')}\n\n` +
               `${linha('Mensagens na fila', stats.pendingMessages)}\n` +
               `${linha('Downloads pesados na fila', stats.downloadsQueued)}\n` +
               `${linha('IA / processamento na fila', stats.iaQueued)}\n` +
               `${linha('Tempo médio entre envios', `~${stats.avgDelay} (1.8s - 3.0s)`)}\n` +
               `${linha('Filas ativas (grupos/PV)', stats.activeQueues)}\n` +
               `${linha('Fila ativa', stats.isActive ? 'Sim' : 'Não')}`;

  await sock.sendMessage(from, { text }, { quoted: msg });
}
