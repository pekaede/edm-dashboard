export function extractStaticRoot(html) {
  const opening = '<div id="root">';
  const start = html.indexOf(opening);
  if (start === -1) return undefined;

  const contentStart = start + opening.length;
  // 跳过注释与脚本/样式文本，按 div 嵌套定位 root 自身的闭合标签。
  const tags = /<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>|<\/?div\b[^>]*>/gi;
  tags.lastIndex = contentStart;
  let depth = 1;
  for (let tag; (tag = tags.exec(html));) {
    if (tag[0].startsWith("<!--") || tag[1]) continue;
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(contentStart, tag.index);
  }
  return undefined;
}
