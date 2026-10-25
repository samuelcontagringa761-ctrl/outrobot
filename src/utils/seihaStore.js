/**
 * Armazenamento simples em JSON para os recursos do Seiha que não precisam de
 * tabela própria (família, estatísticas e herança).
 *
 * Os arquivos ficam no DATA_DIR — no Railway, o volume persistente. A escrita
 * é atômica (arquivo temporário + rename) para não corromper o JSON se o
 * processo morrer no meio.
 */

import fs from 'fs';
import { dataPath } from '../config/paths.js';

const cache = new Map();

/** Lê um JSON do DATA_DIR. `nome` é o nome do arquivo, ex: 'seiha_familia.json'. */
export function lerJson(nome, padrao = {}) {
  if (cache.has(nome)) return cache.get(nome);

  const caminho = dataPath(nome);
  try {
    if (fs.existsSync(caminho)) {
      const bruto = fs.readFileSync(caminho, 'utf8').trim();
      if (bruto) {
        const dados = JSON.parse(bruto);
        cache.set(nome, dados);
        return dados;
      }
    }
  } catch (err) {
    console.warn(`[dados] ⚠️ Não consegui ler ${nome}: ${err.message}`);
  }

  cache.set(nome, padrao);
  return padrao;
}

/** Grava um JSON no DATA_DIR e mantém o cache em memória sincronizado. */
export function salvarJson(nome, dados) {
  cache.set(nome, dados);

  const caminho = dataPath(nome);
  try {
    const temporario = `${caminho}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(dados, null, 2), 'utf8');
    fs.renameSync(temporario, caminho);
    return true;
  } catch (err) {
    console.warn(`[dados] ⚠️ Falha ao salvar ${nome}: ${err.message}`);
    try {
      fs.writeFileSync(caminho, JSON.stringify(dados, null, 2), 'utf8');
      return true;
    } catch (err2) {
      console.warn(`[dados] ❌ Não foi possível gravar ${nome}: ${err2.message}`);
      return false;
    }
  }
}

const doisDigitos = (n) => String(n).padStart(2, '0');

/** Data/hora de Brasília (UTC-3) como objeto Date em UTC. */
export function dataBR(ms = Date.now()) {
  return new Date(ms - 3 * 3600 * 1000);
}

/** Chave do dia no formato AAAA-MM-DD (Brasília). */
export function chaveDiaBR(ms = Date.now()) {
  const d = dataBR(ms);
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}-${doisDigitos(d.getUTCDate())}`;
}

/** Chave do mês no formato AAAA-MM (Brasília). */
export function chaveMesBR(ms = Date.now()) {
  const d = dataBR(ms);
  return `${d.getUTCFullYear()}-${doisDigitos(d.getUTCMonth() + 1)}`;
}

/** Hora no formato HH:MM (Brasília). */
export function formatarHoraBR(ms) {
  const d = dataBR(ms);
  return `${doisDigitos(d.getUTCHours())}:${doisDigitos(d.getUTCMinutes())}`;
}

/** Data e hora no formato DD/MM às HH:MM (Brasília). */
export function formatarDataHoraBR(ms) {
  const d = dataBR(ms);
  return `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)} às ${doisDigitos(d.getUTCHours())}:${doisDigitos(d.getUTCMinutes())}`;
}

export const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

/** Nome do mês (1-12) em português. */
export function nomeDoMes(numero) {
  return MESES[Math.max(0, Math.min(11, Number(numero) - 1))];
}

/** Só o número do JID, sem o domínio. */
export function numeroDoJid(jid) {
  return String(jid || '').split('@')[0];
}
