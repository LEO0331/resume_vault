const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

// Render the portable Markdown used by the resume templates. Raw HTML is text,
// and images are not loaded, so imported content cannot execute or fetch data.
const inline = (value) => {
  const tokens = [];
  const token = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
  let text = String(value).replace(/\u0000/g, "");
  text = text.replace(/`([^`]+)`/g, (_, code) => token(`<code>${escapeHtml(code)}</code>`));
  text = text.replace(/!?\[([^\]]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
    if (match.startsWith("!")) return token(escapeHtml(label));
    const safe = /^(https?:\/\/|mailto:|tel:)/i.test(url);
    return token(safe ? `<a href="${escapeHtml(url)}">${inline(label)}</a>` : inline(label));
  });
  text = escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, (_, value) => `<strong>${value}</strong>`)
    .replace(/(^|[\s(])__(.+?)__(?=$|[\s).,!?:;])/g, (_, before, value) => `${before}<strong>${value}</strong>`)
    .replace(/\*([^*]+)\*/g, (_, value) => `<em>${value}</em>`)
    .replace(/(^|[\s(])_([^_]+)_(?=$|[\s).,!?:;])/g, (_, before, value) => `${before}<em>${value}</em>`);
  return text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
};

export const markdownToHtml = (markdownText, { locale = "en-AU" } = {}) => {
  const html = [];
  const paragraph = [];
  const lists = [];
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p>${inline(paragraph.splice(0).join(" "))}</p>`);
  };
  const closeList = () => {
    const list = lists.pop();
    if (list) html.push(`</li></${list.type}>`);
  };
  const closeLists = () => { while (lists.length) closeList(); };
  for (const raw of String(markdownText || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) { flushParagraph(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/);
    if (heading) {
      flushParagraph(); closeLists();
      html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`);
      continue;
    }
    const bullet = raw.match(/^(\s*)(?:([-+*])|(\d+)[.)])\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      const indent = bullet[1].replace(/\t/g, "    ").length;
      const type = bullet[3] ? "ol" : "ul";
      while (lists.length && (indent < lists.at(-1).indent || (indent === lists.at(-1).indent && type !== lists.at(-1).type))) closeList();
      if (!lists.length || indent > lists.at(-1).indent) {
        const start = type === "ol" && Number(bullet[3]) !== 1 ? ` start="${Number(bullet[3])}"` : "";
        html.push(`<${type}${start}><li>${inline(bullet[4])}`);
        lists.push({ indent, type });
      } else {
        html.push(`</li><li>${inline(bullet[4])}`);
      }
      continue;
    }
    if (lists.length && /^\s+/.test(raw)) {
      html.push(` ${inline(line)}`);
      continue;
    }
    closeLists();
    paragraph.push(line.replace(/^>\s?/, ""));
  }
  flushParagraph(); closeLists();
  const language = locale === "zh-TW" ? "zh-TW" : "en-AU";
  return `<!doctype html>
<html lang="${language}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'none'" />
  <title>Resume</title>
  <style>
    @page { size: A4; margin: 16mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, "Noto Sans CJK TC", "Microsoft JhengHei", "PingFang TC", sans-serif; font-size: 10.5pt; line-height: 1.42; margin: 0; color: #111; overflow-wrap: anywhere; }
    h1, h2, h3, h4, h5, h6 { line-height: 1.2; break-after: avoid-page; page-break-after: avoid; }
    h1 { margin: 0 0 5pt; font-size: 22pt; font-weight: 700; }
    h2 { margin: 13pt 0 5pt; font-size: 12pt; border-bottom: .6pt solid #777; padding-bottom: 3pt; }
    h3, h4, h5, h6 { margin: 9pt 0 3pt; font-size: 10.5pt; }
    p { margin: 4pt 0 6pt; orphans: 3; widows: 3; }
    ul, ol { margin: 4pt 0 7pt; padding-left: 15pt; }
    li { margin: 2pt 0; break-inside: avoid-page; orphans: 2; widows: 2; }
    li > ul, li > ol { margin: 2pt 0; }
    a { color: inherit; text-decoration: none; }
    code { font-family: "Courier New", monospace; font-size: .95em; }
    @media screen { body { max-width: 178mm; margin: 16mm auto; padding: 0 4mm; } }
  </style>
</head>
<body>
${html.join("\n")}
</body>
</html>`;
};
