/**
 * BM25 检索工具：对文本片段做词项相关性打分
 * 解决「纯向量检索在订单号/产品型号/专业术语等场景召回不准」的问题
 * 教程对应：阶段二-理解原理/05-BM25向量检索与混合搜索
 */

/** 简易中文分词：字符 bigram + 保留数字/字母串 */
export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  // 数字/字母/常见符号整体成词（如 SO20260913001、iPhone15）
  const latin = text.match(/[A-Za-z0-9][A-Za-z0-9._\-]*/g) ?? [];
  tokens.push(...latin.map((t) => t.toLowerCase()));

  // 中文按 bigram 切分
  const zh = text.replace(/[A-Za-z0-9._\-]/g, '');
  for (let i = 0; i < zh.length - 1; i++) {
    const gram = zh.slice(i, i + 2).trim();
    if (gram.length === 2) tokens.push(gram);
  }
  return tokens;
}

/** 词频统计 */
function termFreq(tokens: string[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of tokens) map.set(t, (map.get(t) ?? 0) + 1);
  return map;
}

export interface Bm25Hit {
  index: number;
  text: string;
  score: number;
}

/**
 * 对候选片段（含原始文本）做 BM25 打分
 * @param query 查询
 * @param docs  候选文本列表
 * @param k1/b  经典 BM25 参数
 */
export function bm25Score(query: string, docs: string[], k1 = 1.5, b = 0.75): Bm25Hit[] {
  const n = docs.length;
  const qTokens = tokenize(query);
  if (n === 0 || qTokens.length === 0) return [];

  const docTokens = docs.map(tokenize);
  const docLengths = docTokens.map((t) => t.length);
  const avgdl = docLengths.reduce((a, b) => a + b, 0) / n || 1;

  // 文档频率：出现某词项的文档数
  const df = new Map<string, number>();
  for (const toks of docTokens) {
    const set = new Set(toks);
    for (const t of set) df.set(t, (df.get(t) ?? 0) + 1);
  }

  const idfCache = new Map<string, number>();
  const idf = (t: string) => {
    if (!idfCache.has(t)) {
      const d = df.get(t) ?? 0;
      idfCache.set(t, Math.log(1 + (n - d + 0.5) / (d + 0.5)));
    }
    return idfCache.get(t)!;
  };

  const hits: Bm25Hit[] = [];
  for (let i = 0; i < n; i++) {
    const tf = termFreq(docTokens[i]);
    const dl = docLengths[i];
    let score = 0;
    for (const t of new Set(qTokens)) {
      const f = tf.get(t) ?? 0;
      if (f === 0) continue;
      score += idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl) / avgdl)));
    }
    if (score > 0) hits.push({ index: i, text: docs[i], score });
  }
  return hits.sort((a, b) => b.score - a.score);
}
