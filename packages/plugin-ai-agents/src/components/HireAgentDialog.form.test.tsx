import '../setupTests';
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  render,
  cleanup,
  screen,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { HireAgentDialog } from './HireAgentDialog';
import { makeAgent } from '../__fixtures__/agents';
import type { HireField } from '../types';

afterEach(cleanup);

const ok = async () => ({ sessionId: 's'.repeat(33), responseText: 'done' });

const open = (
  hireSchema: HireField[],
  props: Partial<React.ComponentProps<typeof HireAgentDialog>> = {},
  agent: Parameters<typeof makeAgent>[0] = {},
) =>
  render(
    <HireAgentDialog
      agent={makeAgent({
        hireSchema,
        runtime: { runtime: 'custom' } as any,
        ...agent,
      })}
      open
      onClose={() => {}}
      onInvoke={ok}
      {...props}
    />,
  );

test('renders one control per field type, with labels and help', () => {
  open([
    { name: 'a', label: 'Name', type: 'text', help: 'Who to run for' },
    { name: 'b', label: 'Site', type: 'url' },
    { name: 'c', label: 'Notes', type: 'textarea' },
    { name: 'd', label: 'Count', type: 'number' },
    { name: 'e', label: 'Mode', type: 'select', options: ['fast', 'slow'] },
  ]);
  assert.equal(
    (screen.getByRole('textbox', { name: /^Name/ }) as HTMLInputElement).type,
    'text',
  );
  assert.equal(
    (screen.getByRole('textbox', { name: /^Site/ }) as HTMLInputElement).type,
    'url',
  );
  assert.equal(
    screen.getByRole('textbox', { name: /^Notes/ }).tagName,
    'TEXTAREA',
  );
  assert.ok(screen.getByRole('textbox', { name: /^Count/ }));
  assert.ok(screen.getByText('Who to run for'));
  assert.ok(screen.getByText('Mode'));
});

test('Run agent stays disabled until every required field is filled', () => {
  open([
    { name: 'repo', label: 'Repo', type: 'text', required: true },
    { name: 'note', label: 'Note', type: 'text' },
  ]);
  const run = () => screen.getByRole('button', { name: 'Run agent' });
  assert.equal(run().hasAttribute('disabled'), true);
  fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: 'x' } });
  assert.equal(run().hasAttribute('disabled'), true, 'optional field only');
  fireEvent.change(screen.getByLabelText(/^Repo/), {
    target: { value: 'a/b' },
  });
  assert.equal(run().hasAttribute('disabled'), false);
});

test('field defaults pre-fill the form and reach the invocation', async () => {
  const seen: Record<string, string>[] = [];
  open(
    [
      { name: 'repo', label: 'Repo', type: 'text', default: 'org/app' },
      { name: 'mode', label: 'Mode', type: 'text', default: 'quick' },
    ],
    {
      onInvoke: async values => {
        seen.push(values);
        return ok();
      },
    },
  );
  assert.equal(
    (screen.getByLabelText(/^Repo/) as HTMLInputElement).value,
    'org/app',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Run agent' }));
  await waitFor(() => assert.equal(seen.length, 1));
  assert.deepEqual(seen[0], { repo: 'org/app', mode: 'quick' });
});

test('after a run, the form gives way to the conversation and a follow-up box', async () => {
  const calls: any[] = [];
  open([{ name: 'repo', label: 'Repo', type: 'text', default: 'a/b' }], {
    onInvoke: async (_values, opts) => {
      calls.push(opts);
      return { ...(await ok()), threadId: 'thread-1' };
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Run agent' }));
  await screen.findByText('done');
  // Parameters are gone; the preview toggle too.
  assert.equal(screen.queryByText('Invocation parameters'), null);
  assert.equal(screen.queryByText('Show invocation preview'), null);

  const send = screen.getByRole('button', { name: 'Send' });
  assert.equal(send.hasAttribute('disabled'), true, 'needs a message');
  fireEvent.change(screen.getByRole('textbox', { name: 'Follow-up message' }), {
    target: { value: 'and the tests?' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => assert.equal(calls.length, 2));
  assert.equal(calls[1].prompt, 'and the tests?');
  assert.equal(calls[1].threadId, 'thread-1');
  assert.equal(calls[1].post, false);
});

test('a failed run shows the error under the turn', async () => {
  open([{ name: 'repo', label: 'Repo', type: 'text', default: 'a/b' }], {
    onInvoke: async () => {
      throw new Error('agent unreachable');
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Run agent' }));
  assert.ok(await screen.findByText('agent unreachable'));
});

test('without an invoker it only offers the CLI command (AgentCore)', async () => {
  const written: string[] = [];
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    value: { writeText: async (t: string) => void written.push(t) },
    configurable: true,
  });
  open(
    [{ name: 'repo', label: 'Repo', type: 'text', default: 'a/b' }],
    { onInvoke: undefined },
    {
      runtime: {
        runtime: 'bedrock-agentcore',
        region: 'eu-west-1',
        runtimeHandle: 'handle-1',
      } as any,
    },
  );
  assert.equal(screen.queryByRole('button', { name: 'Run agent' }), null);
  fireEvent.click(screen.getByRole('button', { name: 'Copy CLI command' }));
  await waitFor(() => assert.equal(written.length, 1));
  assert.match(written[0], /aws bedrock-agentcore invoke-agent-runtime/);
  assert.match(written[0], /--agent-runtime-id 'handle-1'/);
});

test('the prompt template is filled into the preview', () => {
  open(
    [{ name: 'target', label: 'Target', type: 'text', default: '42' }],
    {},
    { promptTemplate: 'Review MR !{target}' },
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Show invocation preview' }),
  );
  assert.ok(screen.getByText('Review MR !42'));
});

test('both the header X and the footer button close the dialog', () => {
  let closed = 0;
  open([{ name: 'repo', label: 'Repo', type: 'text' }], {
    onClose: () => (closed += 1),
  });
  const [header, footer] = screen.getAllByRole('button', { name: 'Close' });
  fireEvent.click(footer);
  assert.equal(closed, 1);
  fireEvent.click(header);
  assert.equal(closed, 2);
});

test('renders nothing for an agent without a hire schema', () => {
  render(
    <HireAgentDialog
      agent={makeAgent({ hireSchema: undefined })}
      open
      onClose={() => {}}
    />,
  );
  assert.equal(document.body.querySelector('[role="dialog"]'), null);
});
