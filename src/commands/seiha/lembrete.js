/**
 * /lembrete — avisos agendados.
 *
 * A tabela `reminders` já existia no banco, mas nenhum comando a usava e não
 * havia quem disparasse os avisos. Aqui ficam o comando e o verificador.
 */

import {
  addReminder,
  deleteReminder,
  getPendingReminders,
  listReminders
} from '../../database/sqlite.js';
import { aviso, info, sucesso, uso } from '../../config/messages.js';
import { formatarDataHoraBR, numeroDoJid } from '../../utils/seihaStore.js';

const MAX_POR_PESSOA = 5;
const MAX_DIAS = 30;
const MAX_TEXTO = 200;

let timer = null;
let verificacaoInicial = null;
let verificando = false;

const codigoDe = (id) => String(id).slice(-4);

function interpretarTempo(token) {
  const texto = String(token || '').toLowerCase().trim();

  const relativo = texto.match(/^(\d{1,3})(min|m|h|d|s)$/);
  if (relativo) {
    const quantidade = Number(relativo[1]);
    const unidade = relativo[2];
    const ms = unidade === 's' ? 1000
      : unidade === 'h' ? 3600000
        : unidade === 'd' ? 86400000
          : 60000;
    return quantidade * ms;
  }

  const horario = texto.match(/^(\d{1,2}):(\d{2})$/);
  if (horario) {
    const horas = Number(horario[1]);
    const minutos = Number(horario[2]);
    if (horas > 23 || minutos > 59) return null;

    // Calcula no relógio de Brasília e devolve a diferença até o alvo.
    const agora = new Date(Date.now() - 3 * 3600 * 1000);
    let alvo = Date.UTC(
      agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(),
      horas, minutos, 0, 0
    );
    let diferenca = alvo - agora.getTime();
    if (diferenca <= 0) diferenca += 86400000;
    return diferenca;
  }

  return null;
}

function listaDeLembretes(sender, from) {
  return listReminders(sender, from);
}

export async function handleLembrete(sock, msg, args, sender, from, prefix) {
  const primeiro = (args[0] || '').toLowerCase();

  if (['cancelar', 'cancel', 'remover'].includes(primeiro)) {
    const codigo = String(args[1] || '').trim();
    if (!codigo) {
      return sock.sendMessage(from, {
        text: uso(`${prefix}lembrete cancelar <código>`, 'O código aparece em `/lembretes`.')
      }, { quoted: msg });
    }

    const alvo = listaDeLembretes(sender, from).find((r) => String(r.id).endsWith(codigo));
    if (!alvo) {
      return sock.sendMessage(from, { text: aviso('Não encontrei esse lembrete.') }, { quoted: msg });
    }

    await deleteReminder(alvo.id);
    return sock.sendMessage(from, {
      text: sucesso(`Lembrete cancelado: *${alvo.message}*.`)
    }, { quoted: msg });
  }

  // Sem argumentos: mostra os lembretes pendentes desta conversa.
  if (!args.length) {
    const pendentes = listaDeLembretes(sender, from);
    if (!pendentes.length) {
      return sock.sendMessage(from, {
        text: info(`Nenhum lembrete pendente. Use \`${prefix}lembrete 10m tomar água\`.`)
      }, { quoted: msg });
    }

    const linhas = pendentes.slice(0, 10).map((r) =>
      `#${codigoDe(r.id)} · *${formatarDataHoraBR(r.target_time)}* — ${r.message}`
    );

    return sock.sendMessage(from, {
      text: `${sucesso(`Você tem *${pendentes.length}* lembrete(s) pendente(s).`)}\n\n${linhas.join('\n')}\n\n` +
        info(`Para cancelar: \`${prefix}lembrete cancelar <código>\`.`)
    }, { quoted: msg });
  }

  const diferenca = interpretarTempo(args[0]);
  if (!diferenca) {
    return sock.sendMessage(from, {
      text: uso(`${prefix}lembrete 10m tomar água`, 'Aceita *30m*, *2h*, *1d* ou um horário como *18:30*.')
    }, { quoted: msg });
  }

  if (diferenca < 60000) {
    return sock.sendMessage(from, { text: aviso('O prazo mínimo é de 1 minuto.') }, { quoted: msg });
  }
  if (diferenca > MAX_DIAS * 86400000) {
    return sock.sendMessage(from, { text: aviso(`O prazo máximo é de ${MAX_DIAS} dias.`) }, { quoted: msg });
  }

  const texto = args.slice(1).join(' ').trim();
  if (!texto) {
    return sock.sendMessage(from, {
      text: uso(`${prefix}lembrete 10m tomar água`)
    }, { quoted: msg });
  }
  if (texto.length > MAX_TEXTO) {
    return sock.sendMessage(from, {
      text: aviso(`O lembrete pode ter no máximo ${MAX_TEXTO} caracteres.`)
    }, { quoted: msg });
  }

  const pendentes = listaDeLembretes(sender, from);
  if (pendentes.length >= MAX_POR_PESSOA) {
    return sock.sendMessage(from, {
      text: aviso(`Você já tem *${MAX_POR_PESSOA}* lembretes pendentes. Cancele um antes de criar outro.`)
    }, { quoted: msg });
  }

  const alvo = Date.now() + diferenca;
  const lembrete = await addReminder(sender, from, alvo, texto);

  return sock.sendMessage(from, {
    text: sucesso(`Lembrete *#${codigoDe(lembrete.id)}* marcado para *${formatarDataHoraBR(alvo)}*: ${texto}`)
  }, { quoted: msg });
}

/**
 * Verifica os lembretes vencidos a cada 20s e avisa no chat de origem.
 * É chamado a cada conexão nova; o timer anterior é descartado.
 */
export function startReminderScheduler(sock) {
  if (timer) clearInterval(timer);
  if (verificacaoInicial) clearTimeout(verificacaoInicial);

  const verificar = async () => {
    if (verificando) return;
    verificando = true;

    try {
      let pendentes = [];
      try {
        pendentes = getPendingReminders();
      } catch (err) {
        console.warn(`[lembrete] ⚠️ Falha ao consultar o banco: ${err.message}`);
        return;
      }

      for (const lembrete of pendentes) {
        const numero = numeroDoJid(lembrete.user_jid);
        try {
          await sock.sendMessage(lembrete.chat_jid, {
            text: `⏰ @${numero}, lembrete: *${lembrete.message}*`,
            mentions: [lembrete.user_jid]
          });
        } catch (err) {
          console.warn(`[lembrete] ⚠️ Não consegui avisar ${numero}: ${err.message}`);
        }

        // Remove mesmo se o envio falhar: um lembrete preso não pode repetir
        // para sempre a cada 20 segundos.
        try {
          await deleteReminder(lembrete.id);
        } catch (err) {
          console.warn(`[lembrete] ⚠️ Falha ao apagar o lembrete ${lembrete.id}: ${err.message}`);
        }
      }
    } finally {
      verificando = false;
    }
  };

  timer = setInterval(verificar, 20000);
  verificacaoInicial = setTimeout(verificar, 3000);
  console.log('[lembrete] ⏰ Verificador de lembretes ativo.');
}
