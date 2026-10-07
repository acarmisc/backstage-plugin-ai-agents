import React, { ComponentProps } from 'react';
import { Dialog } from '@backstage/ui';

const KEYFRAMES = `
@keyframes ai-agents-panel-in { from { transform: translateX(32px); opacity: 0; } to { transform: none; opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .ai-agents-side-panel { animation: none !important; } }
`;

export type SidePanelProps = Omit<
  ComponentProps<typeof Dialog>,
  'height' | 'style' | 'className'
>;

/**
 * A panel docked to the right edge, full height. It is BUI's `Dialog`
 * (focus trap, Escape, scrim, close button) laid out as a drawer, so use it
 * with `DialogHeader` / `DialogBody` as usual.
 */
export function SidePanel({ width = 560, ...rest }: SidePanelProps) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <Dialog
        width={width}
        className="ai-agents-side-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          height: '100%',
          maxHeight: '100%',
          margin: 0,
          borderRadius: 0,
          borderTop: 'none',
          borderBottom: 'none',
          borderRight: 'none',
          animation: 'ai-agents-panel-in 200ms ease-out',
        }}
        {...rest}
      />
    </>
  );
}
