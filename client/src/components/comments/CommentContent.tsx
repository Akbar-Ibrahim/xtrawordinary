import React, { type ReactNode } from "react";
import type { CommentMention } from "@shared/schema";

const INLINE_MARKDOWN_TOKEN =
  /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*]+\*|_[^_]+_)/g;
const COMMENT_MENTION_TOKEN = /@[a-zA-Z0-9_]{3,20}(?![a-zA-Z0-9_])/g;

function findCommentMentions(text: string, mentionUsers: Map<string, CommentMention>) {
  const mentions: Array<{ start: number; end: number; user: CommentMention }> = [];
  for (const match of text.matchAll(COMMENT_MENTION_TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    const precedingCharacter = start > 0 ? text[start - 1] : undefined;
    const user = mentionUsers.get(token.slice(1).toLowerCase());
    if (user && (!precedingCharacter || !/[a-zA-Z0-9_]/.test(precedingCharacter))) {
      mentions.push({ start, end: start + token.length, user });
    }
  }
  return mentions;
}

function renderTextHighlights(text: string, keyPrefix: string, highlightTerm?: string): ReactNode[] {
  if (!highlightTerm) return [text];

  const escapedTerm = highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...text.matchAll(new RegExp(escapedTerm, "giu"))];
  if (matches.length === 0) return [text];

  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark
        key={`${keyPrefix}-highlight-${index}`}
        className="rounded-sm bg-yellow-200 text-yellow-950 dark:bg-yellow-500/30 dark:text-inherit"
      >
        {match[0]}
      </mark>,
    );
    cursor = start + match[0].length;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function renderHighlightedText(
  text: string,
  keyPrefix: string,
  highlightTerm?: string,
  mentionUsers?: Map<string, CommentMention>,
): ReactNode[] {
  if (!mentionUsers?.size) return renderTextHighlights(text, keyPrefix, highlightTerm);

  const nodes: ReactNode[] = [];
  let cursor = 0;
  const mentions = findCommentMentions(text, mentionUsers);

  for (const [mentionIndex, mention] of mentions.entries()) {
    const token = text.slice(mention.start, mention.end);
    if (mention.start > cursor) {
      nodes.push(...renderTextHighlights(text.slice(cursor, mention.start), `${keyPrefix}-${mentionIndex}`, highlightTerm));
    }
    nodes.push(
      <a
        key={`${keyPrefix}-mention-${mentionIndex}`}
        href={`/u/${encodeURIComponent(mention.user.username)}`}
        className="text-primary underline underline-offset-2"
        data-testid={`link-comment-mention-${mention.user.id}`}
      >
        {renderTextHighlights(token, `${keyPrefix}-mention-${mentionIndex}`, highlightTerm)}
      </a>,
    );
    cursor = mention.end;
  }

  if (cursor === 0) return renderTextHighlights(text, keyPrefix, highlightTerm);
  if (cursor < text.length) {
    nodes.push(...renderTextHighlights(text.slice(cursor), `${keyPrefix}-${mentions.length}`, highlightTerm));
  }
  return nodes;
}

function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
  highlightTerm?: string,
  mentionUsers?: Map<string, CommentMention>,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let tokenIndex = 0;
  const mentionRanges = mentionUsers?.size ? findCommentMentions(text, mentionUsers) : [];

  for (const match of text.matchAll(INLINE_MARKDOWN_TOKEN)) {
    const token = match[0];
    const start = match.index ?? 0;
    const tokenEnd = start + token.length;
    const overlappingMention = mentionRanges.some(
      (mention) => mention.start < tokenEnd && mention.end > start,
    );
    const safelyWrapsMention = mentionRanges.some(
      (mention) => mention.start >= start
        && mention.end <= tokenEnd
        && (token.startsWith("**") || token.startsWith("__") || token.startsWith("*")),
    );
    if (overlappingMention && !safelyWrapsMention) continue;
    if (start > cursor) {
      nodes.push(...renderHighlightedText(text.slice(cursor, start), `${keyPrefix}-${tokenIndex}`, highlightTerm, mentionUsers));
    }

    const key = `${keyPrefix}-${tokenIndex++}`;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
    if (link) {
      nodes.push(
        <a
          key={key}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {renderTextHighlights(link[1], key, highlightTerm)}
        </a>,
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      nodes.push(<strong key={key}>{renderHighlightedText(token.slice(2, -2), key, highlightTerm, mentionUsers)}</strong>);
    } else if (token.startsWith("`")) {
      nodes.push(
        <code key={key} className="rounded bg-background px-1 font-mono text-xs">
          {renderTextHighlights(token.slice(1, -1), key, highlightTerm)}
        </code>,
      );
    } else {
      nodes.push(<em key={key}>{renderHighlightedText(token.slice(1, -1), key, highlightTerm, mentionUsers)}</em>);
    }
    cursor = start + token.length;
  }

  if (cursor < text.length) {
    nodes.push(...renderHighlightedText(text.slice(cursor), `${keyPrefix}-${tokenIndex}`, highlightTerm, mentionUsers));
  }
  return nodes;
}

function renderBlocks(
  content: string,
  highlightTerm?: string,
  mentionUsers?: Map<string, CommentMention>,
): ReactNode[] {
  const blocks: ReactNode[] = [];
  let paragraphLines: string[] = [];
  let listItems: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const blockIndex = blocks.length;
    blocks.push(
      <p key={`paragraph-${blockIndex}`} className="whitespace-normal break-words">
        {paragraphLines.map((line, index) => (
          <span key={`line-${index}`}>
            {index > 0 && <br />}
            {renderInlineMarkdown(line, `paragraph-${blockIndex}-line-${index}`, highlightTerm, mentionUsers)}
          </span>
        ))}
      </p>,
    );
    paragraphLines = [];
  };

  const flushList = () => {
    if (listItems.length === 0) return;
    const blockIndex = blocks.length;
    blocks.push(
      <ul key={`list-${blockIndex}`} className="list-disc space-y-1 pl-5">
        {listItems.map((item, index) => (
          <li key={`item-${index}`}>{renderInlineMarkdown(item, `list-${blockIndex}-item-${index}`, highlightTerm, mentionUsers)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  for (const line of content.split(/\r?\n/)) {
    const listItem = /^\s*[-*]\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      listItems.push(listItem[1]);
    } else if (!line.trim()) {
      flushParagraph();
      flushList();
    } else {
      flushList();
      paragraphLines.push(line);
    }
  }

  flushParagraph();
  flushList();
  return blocks;
}

export function CommentContent({
  content,
  className = "",
  testId,
  highlightTerm,
  mentionUsers = [],
}: {
  content: string;
  className?: string;
  testId?: string;
  highlightTerm?: string;
  mentionUsers?: CommentMention[];
}) {
  const normalizedTerm = highlightTerm?.trim();
  const contentMatches = normalizedTerm
    ? new RegExp(normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "iu").test(content)
    : false;
  const mentionUserMap = new Map(mentionUsers.map((user) => [user.username.toLowerCase(), user]));

  return (
    <div className={`space-y-2 break-words ${className}`} data-testid={testId}>
      {renderBlocks(content, contentMatches ? normalizedTerm : undefined, mentionUserMap)}
    </div>
  );
}
