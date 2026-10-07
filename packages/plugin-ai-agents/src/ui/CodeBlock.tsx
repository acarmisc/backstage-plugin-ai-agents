import React, { useEffect, useState } from 'react';
import { ButtonIcon } from '@backstage/ui';
import { RiCheckLine, RiFileCopyLine } from '@remixicon/react';

export interface CodeBlockProps {
  text: string;
  /** Shown as `data-language`; no syntax highlighting is done. */
  language?: string;
  /** Wrap long lines (default) or scroll horizontally. */
  wrap?: boolean;
  maxHeight?: number;
}

/**
 * Preformatted text with a copy button, built on BUI tokens (BUI has no code
 * block component).
 */
export function CodeBlock({
  text,
  language,
  wrap = true,
  maxHeight = 260,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const id = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(id);
  }, [copied]);

  const copy = () => {
    navigator.clipboard
      ?.writeText(text)
      .then(() => setCopied(true))
      .catch(() => {});
  };

  return (
    <div style={{ position: 'relative' }}>
      <pre
        data-language={language}
        style={{
          margin: 0,
          padding: 'var(--bui-space-3)',
          paddingRight: 'var(--bui-space-10)',
          background: 'var(--bui-bg-neutral-2)',
          border: '1px solid var(--bui-border-1)',
          borderRadius: 'var(--bui-radius-2)',
          color: 'var(--bui-fg-primary)',
          fontFamily: 'var(--bui-font-monospace)',
          fontSize: 'var(--bui-font-size-2)',
          lineHeight: 1.5,
          whiteSpace: wrap ? 'pre-wrap' : 'pre',
          wordBreak: wrap ? 'break-word' : 'normal',
          overflow: 'auto',
          maxHeight,
        }}
      >
        <code>{text}</code>
      </pre>
      <div style={{ position: 'absolute', top: 4, right: 4 }}>
        <ButtonIcon
          aria-label={copied ? 'Copied' : 'Copy to clipboard'}
          variant="tertiary"
          size="small"
          icon={
            copied ? <RiCheckLine size={16} /> : <RiFileCopyLine size={16} />
          }
          onPress={copy}
        />
      </div>
    </div>
  );
}
