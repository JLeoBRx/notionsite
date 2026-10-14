/* Renderizador de Markdown enxuto para o subconjunto que o Notion exporta:
   títulos, parágrafos, listas aninhadas (4 espaços), checkboxes, tabelas,
   citações, linhas horizontais, imagens, links, negrito, itálico, riscado e código.
   Todo texto é escapado antes da formatação inline. */
(function () {
  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function safeUrl(url) {
    const u = url.trim();
    if (/^(https?:|mailto:|tel:|#|data\/media\/)/i.test(u)) return u;
    return "#";
  }

  function inline(text) {
    const codes = [];
    let s = text.replace(/`([^`]+)`/g, (_, c) => {
      codes.push(c);
      return `\u0000${codes.length - 1}\u0000`;
    });
    s = esc(s);
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
      `<img src="${esc(safeUrl(url))}" alt="${alt}" loading="lazy">`);
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      const href = safeUrl(url.replace(/&amp;/g, "&"));
      const internal = href.startsWith("#");
      return `<a href="${esc(href)}"${internal ? ' class="md-internal"' : ' target="_blank" rel="noopener"'}>${label}</a>`;
    });
    // URLs soltas no texto
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, (_, pre, url) =>
      `${pre}<a href="${url}" target="_blank" rel="noopener">${url}</a>`);
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, "$1<em>$2</em>");
    s = s.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    s = s.replace(/‣/g, '<span class="md-mention" title="Menção do Notion">↗</span>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${esc(codes[+i])}</code>`);
    return s;
  }

  const indentOf = (line) => line.match(/^ */)[0].length;
  const listRe = /^(\s*)([-*+]|\d+\.)\s+(.*)$/;

  function parseList(lines, start) {
    const baseIndent = indentOf(lines[start]);
    const ordered = /^\s*\d+\./.test(lines[start]);
    let html = ordered ? "<ol>" : "<ul>";
    let i = start;
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) {
        // linha vazia dentro da lista: continua se a próxima ainda for item no mesmo nível ou mais fundo
        const next = lines.slice(i + 1).find((l) => l.trim());
        if (next && listRe.test(next) && indentOf(next) >= baseIndent) { i++; continue; }
        break;
      }
      const m = line.match(listRe);
      const ind = indentOf(line);
      if (ind < baseIndent) break;
      if (!m || ind > baseIndent) {
        if (ind > baseIndent && m) {
          const sub = parseList(lines, i);
          html = html.replace(/<\/li>$/, "") + sub.html + "</li>";
          i = sub.next;
          continue;
        }
        if (ind > baseIndent) {
          html = html.replace(/<\/li>$/, "") + `<br>${inline(line.trim())}</li>`;
          i++;
          continue;
        }
        break;
      }
      if (ordered !== /^\d+\./.test(m[2])) break;
      let content = m[3];
      const box = content.match(/^\[([ xX])\]\s*(.*)$/);
      if (box) {
        const done = box[1] !== " ";
        html += `<li class="md-task${done ? " done" : ""}"><span class="md-check" aria-hidden="true">${done ? "✓" : ""}</span><span>${inline(box[2])}</span></li>`;
      } else {
        html += `<li>${inline(content)}</li>`;
      }
      i++;
    }
    html += ordered ? "</ol>" : "</ul>";
    return { html, next: i };
  }

  function parseTable(lines, start) {
    const rows = [];
    let i = start;
    while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
      rows.push(lines[i].trim().slice(1, -1).split("|").map((c) => c.trim()));
      i++;
    }
    const hasHeader = rows[1] && rows[1].every((c) => /^:?-{2,}:?$/.test(c));
    let html = '<div class="md-table"><table>';
    if (hasHeader) {
      html += "<thead><tr>" + rows[0].map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead>";
      rows.splice(0, 2);
    }
    html += "<tbody>" + rows.map((r) => "<tr>" + r.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody>";
    return { html: html + "</table></div>", next: i };
  }

  function render(md) {
    const lines = (md || "").replace(/\r/g, "").split("\n");
    let html = "";
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();
      if (!t) { i++; continue; }
      if (/^```/.test(t)) {
        const buf = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i].trim())) buf.push(lines[i++]);
        html += `<pre><code>${esc(buf.join("\n"))}</code></pre>`;
        i++;
        continue;
      }
      const h = t.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        // o título da página já aparece no cabeçalho do painel, então os níveis descem um degrau
        const level = Math.min(h[1].length + 2, 6);
        html += `<h${level}>${inline(h[2])}</h${level}>`;
        i++;
        continue;
      }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) { html += "<hr>"; i++; continue; }
      if (/^\|.*\|$/.test(t)) {
        const r = parseTable(lines, i);
        html += r.html; i = r.next; continue;
      }
      if (listRe.test(line)) {
        const r = parseList(lines, i);
        html += r.html; i = r.next; continue;
      }
      if (/^>/.test(t)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ""));
        html += `<blockquote>${render(buf.join("\n"))}</blockquote>`;
        continue;
      }
      const buf = [];
      while (i < lines.length && lines[i].trim() && !/^\s*(#{1,6}\s|[-*+]\s|\d+\.\s|\||>|```|-{3,}$)/.test(lines[i])) {
        buf.push(inline(lines[i].trim()));
        i++;
      }
      if (buf.length) html += `<p>${buf.join("<br>")}</p>`;
      else { html += `<p>${inline(t)}</p>`; i++; }
    }
    return html;
  }

  window.renderMarkdown = render;
})();
