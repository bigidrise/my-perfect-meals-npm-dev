import React from "react";
import { COACH_DESTINATIONS } from "@shared/coaching/navigation";

const featureNames = [...new Set(Object.values(COACH_DESTINATIONS).flatMap(destination =>
  [destination.label, ...("navigationLabel" in destination ? [destination.navigationLabel] : [])]))]
  .sort((a, b) => b.length - a.length)
  .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
const featurePattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${featureNames.join("|")})(?![\\p{L}\\p{N}_])`, "giu");

function featureEmphasis(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let end = 0;
  for (const match of text.matchAll(featurePattern)) {
    parts.push(text.slice(end, match.index!));
    parts.push(<strong key={match.index} className="font-semibold">{match[0]}</strong>);
    end = match.index! + match[0].length;
  }
  parts.push(text.slice(end));
  return parts;
}

/** Deliberately limited inline formatting: no HTML, links, images or execution. */
function emphasis(text: string, depth = 0, features = false): React.ReactNode {
  const plain = (value: string) => features ? featureEmphasis(value) : value;
  if (depth > 3) return plain(text);
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
    parts.push(plain(text.slice(end, start)));
    if (match[1]) {
      parts.push(match[1]);
    } else {
      const inner = emphasis(content, depth + 1, features && marker.length === 1);
      parts.push(marker.length === 1 ? <em key={start}>{inner}</em>
        : <strong key={start} className="font-semibold">
          {marker.length === 3 ? <em>{inner}</em> : inner}
        </strong>);
    }
    end = start + match[0].length;
  }
  parts.push(plain(text.slice(end)));
  return parts;
}

/** Restricted inline formatting plus registry-owned feature emphasis. */
export function chefResponseText(text: string | null | undefined, enabled: boolean, features = false): React.ReactNode {
  if (!enabled || !text) return text;
  // Asterisk bullets become readable bullets; numbered lines remain unchanged.
  const readable = text.replace(/^([ \t]*)\* (?=\S)/gm, "$1• ");
  return <span className="whitespace-pre-wrap">{emphasis(readable, 0, features)}</span>;
}
