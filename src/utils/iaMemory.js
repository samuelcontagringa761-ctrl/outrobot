/**
 * Memória do /ia — guarda as últimas perguntas e respostas por conversa
 * e por pessoa, para que perguntas de continuação ("e ele?", "e onde fica?")
 * façam sentido.
 *
 * Fica em DATA_DIR (volume do Railway), então sobrevive a reinício e deploy.
 */

import fs from 'fs';
import { dataPath } from '../config/paths.js';

const ARQUIVO = dataPath('ia_history.json');

const MAX_TROCAS_POR_PESSOA = 4;   // 4 perguntas + 4 respostas por pessoa/chat
const MAX_CONVERSAS = 400;         // chats distintos guardados no arquivo
const MAX_RESPOSTA_SALVA = 900;    // caracteres da resposta guardada

function carregar() {
  try {
    if (!fs.existsSync(ARQUIVO)) return {};
    const dados = JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'));
    return dados && typeof dados === 'object' ? dados : {};
  } catch (err) {
    console.warn('[ia] ⚠️ Não consegui ler o histórico:', err.message);
    return {};
  }
}

const store = carregar();

function ultimaAtividade(conversa) {
  let maior = 0;
  for (const lista of Object.values(conversa || {})) {
    const ultima = lista?.[lista.length - 1];
    if (ultima?.ts > maior) maior = ultima.ts;
  }
  return maior;
}

function salvar() {
  try {
    const chats = Object.keys(store);
    if (chats.length > MAX_CONVERSAS) {
      chats.sort((a, b) => ultimaAtividade(store[a]) - ultimaAtividade(store[b]));
      for (const chat of chats.slice(0, chats.length - MAX_CONVERSAS)) delete store[chat];
    }
    fs.writeFileSync(ARQUIVO, JSON.stringify(store), 'utf-8');
  } catch (err) {
    console.warn('[ia] ⚠️ Não consegui salvar o histórico:', err.message);
  }
}

/** Últimas trocas daquela pessoa naquele chat. */
export function getTrocas(chatJid, sender) {
  return store[chatJid]?.[sender] || [];
}

/** Salva uma pergunta respondida com sucesso. */
export function registrarTroca(chatJid, sender, pergunta, resposta) {
  if (!chatJid || !sender || !pergunta || !resposta) return;

  if (!store[chatJid]) store[chatJid] = {};
  if (!store[chatJid][sender]) store[chatJid][sender] = [];

  const lista = store[chatJid][sender];
  lista.push({
    q: pergunta.slice(0, 350),
    a: resposta.slice(0, MAX_RESPOSTA_SALVA),
    ts: Date.now()
  });

  if (lista.length > MAX_TROCAS_POR_PESSOA) {
    lista.splice(0, lista.length - MAX_TROCAS_POR_PESSOA);
  }

  salvar();
}

/** Apaga o histórico daquela pessoa no chat. Retorna true se havia algo. */
export function limparTrocas(chatJid, sender) {
  if (!store[chatJid]?.[sender]?.length) return false;

  delete store[chatJid][sender];
  if (Object.keys(store[chatJid]).length === 0) delete store[chatJid];
  salvar();
  return true;
}

/** Monta o bloco de contexto que entra no prompt. */
export function montarContexto(trocas) {
  if (!trocas.length) return '';

  const linhas = trocas.map((t, i) => `Pergunta ${i + 1}: ${t.q}\nResposta ${i + 1}: ${t.a}`);
  return 'Conversa anterior neste chat (use para entender perguntas de continuação):\n\n' + linhas.join('\n\n');
}
