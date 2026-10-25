/**
 * Entrada única dos comandos novos do Seiha.
 *
 * O messageHandler só pergunta "esse comando é daqui?"; a lógica fica em
 * módulos separados por assunto para não engordar o dispatcher.
 */

import { erroInterno } from '../../config/messages.js';
import { handleRank } from './rank.js';
import { handleLembrete } from './lembrete.js';
import { handleFamilia } from './familia.js';
import { handleEstudo, handleRedacao } from './estudo.js';
import { handleSimulado } from './simulado.js';
import { handleOmiai } from './omiai.js';
import { handleHeranca } from './heranca.js';

const COMANDOS = new Set([
  'rank', 'ranking', 'top',
  'lembrete', 'lembretes',
  'familia', 'família', 'family',
  'estudo', 'explicar',
  'redacao', 'redação',
  'simulado',
  'omiai',
  'heranca', 'herança'
]);

export async function handleSeihaCommands({
  sock,
  msg,
  command,
  args,
  sender,
  mentioned,
  from,
  isGroup,
  prefix
}) {
  if (!COMANDOS.has(command)) return false;

  try {
    if (['rank', 'ranking', 'top'].includes(command)) {
      await handleRank(sock, msg, args, sender, from, isGroup, prefix);
      return true;
    }

    if (['lembrete', 'lembretes'].includes(command)) {
      const argumentos = command === 'lembretes' ? [] : args;
      await handleLembrete(sock, msg, argumentos, sender, from, prefix);
      return true;
    }

    if (['familia', 'família', 'family'].includes(command)) {
      await handleFamilia(sock, msg, args, sender, from, isGroup, prefix);
      return true;
    }

    if (['estudo', 'explicar'].includes(command)) {
      await handleEstudo(sock, msg, args, sender, from, prefix);
      return true;
    }

    if (['redacao', 'redação'].includes(command)) {
      await handleRedacao(sock, msg, args, sender, from, prefix);
      return true;
    }

    if (command === 'simulado') {
      await handleSimulado(sock, msg, args, sender, from, isGroup);
      return true;
    }

    if (command === 'omiai') {
      await handleOmiai(sock, msg, args, sender, mentioned, from, prefix);
      return true;
    }

    if (['heranca', 'herança'].includes(command)) {
      await handleHeranca(sock, msg, args, sender, from, isGroup, prefix);
      return true;
    }

    return false;
  } catch (err) {
    console.error(`[seiha] Erro no comando /${command}:`, err);
    try {
      await sock.sendMessage(from, { text: erroInterno(command) }, { quoted: msg });
    } catch (_) {}
    return true;
  }
}
