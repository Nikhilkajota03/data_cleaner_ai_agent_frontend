const KEYWORDS =
  /\b(SELECT|FROM|WHERE|UPDATE|SET|DELETE|INSERT|INTO|VALUES|AND|OR|NOT|NULL|IS|IN|LIKE|ILIKE|AS|CASE|WHEN|THEN|ELSE|END|REGEXP_REPLACE|TRIM|UPPER|LOWER|CAST|TRUE|FALSE|NOW|COALESCE|LIMIT|ORDER|BY|GROUP|JOIN|ON)\b/gi;

/** Lightweight SQL highlighter (no deps). Escapes first, then wraps tokens. */
function highlight(sql: string): string {
  const esc = sql.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .replace(/('(?:[^']|'')*')/g, '<span class="sql-str">$1</span>')
    .replace(/(?<![\w">])(\d+(?:\.\d+)?)(?![\w"])/g, '<span class="sql-num">$1</span>')
    .replace(KEYWORDS, (m, _k, offset: number, full: string) => {
      // Skip keywords that sit inside already-wrapped string spans.
      const before = full.slice(0, offset);
      const open = (before.match(/<span class="sql-str">/g) || []).length;
      const close = (before.match(/<\/span>/g) || []).length;
      return open > close ? m : `<span class="sql-kw">${m}</span>`;
    });
}

export default function SqlViewer({ sql }: { sql: string }) {
  return <pre className="sql-block" dangerouslySetInnerHTML={{ __html: highlight(sql) }} />;
}
