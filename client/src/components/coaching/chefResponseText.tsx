import React from "react";

/** Deliberately limited inline formatting: no HTML, links, images or execution. */
function emphasis(text: string, depth = 0): React.ReactNode {
  if (depth > 3) return text;
  const tokens = /\\([\\*_])|(?<!\*)(\*{1,3})(?![\s*])(.+?\S|\S)\2(?!\*)|(?<!_)(_{1,3})(?![\s_])(.+?\S|\S)\4(?!_)/g;
  const parts: React.ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(tokens)) {
    const start = match.index!;
    const marker = match[2] || match[4];
    const content = match[3] || match[5];
    // Keep intraword underscores and ordinary expressions such as 2*3*4.
    if (marker && (marker[0] === "_" || marker.length === 1) &&
      (/\w/.test(text[start - 1] || "") || /\w/.test(text[start + match[0].length] || ""))) continue;
    parts.push(text.slice(end, start));
    if (match[1]) {
      parts.push(match[1]);
    } else {
      const inner = emphasis(content, depth + 1);
      parts.push(marker.length === 1 ? <em key={start}>{inner}</em>
        : <strong key={start} className="font-semibold">
          {marker.length === 3 ? <em>{inner}</em> : inner}
        </strong>);
    }
    end = start + match[0].length;
  }
  parts.push(text.slice(end));
  return parts;
}

/** The caller supplies the existing Development gate; Production stays literal. */
export function chefResponseText(text: string | null | undefined, enabled: boolean): React.ReactNode {
  if (!enabled || !text) return text;
  // Asterisk bullets become readable bullets; numbered lines remain unchanged.
  const readable = text.replace(/^([ \t]*)\* (?=\S)/gm, "$1• ");
  return <span className="whitespace-pre-wrap">{emphasis(readable)}</span>;
}
