/**
 * 文本切片工具：面向中文文档的固定窗口 + 重叠切片
 * @param text   原文
 * @param size   窗口大小（字符数）
 * @param overlap 相邻切片重叠字符数
 */
export function chunkText(text: string, size = 300, overlap = 60): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim();
  if (cleaned.length <= size) return cleaned.length > 0 ? [cleaned] : [];

  const chunks: string[] = [];
  let start = 0;
  const step = Math.max(1, size - overlap);

  while (start < cleaned.length) {
    let end = Math.min(start + size, cleaned.length);
    // 若窗口在句子中部结束，尝试前移到最近的句末标点，减少切碎语义
    if (end < cleaned.length) {
      const tail = cleaned.slice(end - 30, end);
      const cut = Math.max(
        tail.lastIndexOf('。'),
        tail.lastIndexOf('\n'),
        tail.lastIndexOf('；'),
        tail.lastIndexOf('！'),
        tail.lastIndexOf('？'),
      );
      if (cut >= 0) end = end - 30 + cut + 1;
    }
    chunks.push(cleaned.slice(start, end).trim());
    if (end === start) break; // 防御死循环
    start = end;
  }
  return chunks.filter((c) => c.length > 0);
}
