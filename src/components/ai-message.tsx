import { Fragment, type ReactNode } from "react";

/**
 * Markdown-safe renderer for model output. Everything becomes React elements:
 * no dangerouslySetInnerHTML, no HTML parsing, no scripts, no images. Only
 * bold, italic, inline code, bullet and numbered lists are understood; any
 * other markup stays visible as literal text. Bare URLs are linked only when
 * they parse as http(s).
 */
function safeHref(raw: string) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*|https?:\/\/[^\s<>()]+)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (!part) return <Fragment key={key} />;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={key}>{part.slice(1, -1)}</code>;
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2)
      return <em key={key}>{part.slice(1, -1)}</em>;
    if (/^https?:\/\//.test(part)) {
      const href = safeHref(part);
      return href ? (
        <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {part}
        </a>
      ) : (
        <Fragment key={key}>{part}</Fragment>
      );
    }
    return <Fragment key={key}>{part}</Fragment>;
  });
}

export function AIMessageText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, blockIndex) => {
        const lines = block.split("\n").filter((line) => line.trim());
        if (!lines.length) return null;
        const bullets = lines.every((line) => /^\s*[-*]\s+/.test(line));
        const numbered = lines.every((line) => /^\s*\d+[.)]\s+/.test(line));
        if (bullets || numbered) {
          const items = lines.map((line, i) => (
            <li key={i}>
              {inline(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""), `${blockIndex}-${i}`)}
            </li>
          ));
          return numbered ? (
            <ol key={blockIndex}>{items}</ol>
          ) : (
            <ul key={blockIndex}>{items}</ul>
          );
        }
        return (
          <p key={blockIndex}>
            {lines.map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {inline(line, `${blockIndex}-${i}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}
