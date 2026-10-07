import React, { HTMLAttributes, ReactElement } from 'react';
import { Focusable, Tooltip, TooltipTrigger } from '@backstage/ui';

export interface HintProps {
  /** Tooltip text. */
  label: string;
  /** A single DOM element (`span`, `div`, ...) that receives the focus props. */
  children: ReactElement<HTMLAttributes<HTMLElement>, string>;
}

/**
 * Tooltip around a non-interactive element (an icon, a dot, a badge).
 * BUI's `TooltipTrigger` needs a focusable trigger, so the child is wrapped
 * in react-aria's `Focusable`; give it `tabIndex={0}` when it is not
 * focusable already.
 */
export function Hint({ label, children }: HintProps) {
  return (
    <TooltipTrigger>
      <Focusable>{children}</Focusable>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
