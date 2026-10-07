import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogFooter,
  DialogHeader,
  Flex,
  NumberField,
  Select,
  Text,
  TextAreaField,
  TextField,
} from '@backstage/ui';
import {
  RiFileCopyLine,
  RiPlayLine,
  RiSendPlaneLine,
  RiUploadCloud2Line,
} from '@remixicon/react';
import type { InvocationResult } from '../api';
import type { AiAgent, HireField } from '../types';
import { CodeBlock, StatusDot, TONE_BG, TONE_FG } from '../ui';

/** @public */
export interface HireAgentDialogProps {
  agent: AiAgent | null;
  open: boolean;
  onClose: () => void;
  /**
   * Runs the invocation server-side. `opts.threadId` continues an existing
   * conversation; `opts.post` (default false) allows external writes and is
   * only set by the explicit confirm-and-publish step.
   */
  onInvoke?: (
    values: Record<string, string>,
    opts?: { threadId?: string; post?: boolean; prompt?: string },
  ) => Promise<InvocationResult>;
}

interface Turn {
  id: string;
  prompt: string;
  result?: InvocationResult;
  error?: string;
  post: boolean;
}

const fieldDefault = (f: HireField): string => f.default ?? '';

const buildInitialState = (fields: HireField[]): Record<string, string> =>
  Object.fromEntries(fields.map(f => [f.name, fieldDefault(f)]));

const isRequiredMissing = (
  fields: HireField[],
  values: Record<string, string>,
) => fields.some(f => f.required && !values[f.name]?.trim());

/** Replace {name} placeholders in `template` with `values[name]`. Mirrors the backend's fillTemplate in invocation.ts; keep in sync if placeholder syntax changes. */
function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    values[key] !== undefined ? values[key] : `{${key}}`,
  );
}

/** Build the AgentCore HTTP invocation payload (the JSON body of /invocations). */
function buildPayload(prompt: string): { prompt: string } {
  return { prompt };
}

/** Escape single quotes in a string for POSIX shell single-quoting. */
function shellEscapeSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`);
}

/** Build the equivalent AWS CLI command for the AgentCore invocation. */
function buildCliCommand(
  agent: AiAgent,
  payload: { prompt: string },
  sessionId: string,
): string {
  const region = agent.runtime.region ?? '<region>';
  const handle = agent.runtime.runtimeHandle ?? '<runtime-handle>';
  const body = JSON.stringify(payload);
  return [
    'aws bedrock-agentcore invoke-agent-runtime',
    `--region '${shellEscapeSingleQuoted(region)}'`,
    `--agent-runtime-id '${shellEscapeSingleQuoted(handle)}'`,
    `--runtime-session-id '${shellEscapeSingleQuoted(sessionId)}'`,
    `--payload '${shellEscapeSingleQuoted(body)}'`,
  ].join(' \\\n  ');
}

/** AgentCore enforces session ids of at least 33 characters. */
function makeSessionId(): string {
  const raw = `hire-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return raw.padEnd(33, '0').slice(0, 80);
}

function PreviewBlock({
  title,
  language,
  content,
  missingNote,
  collapsible,
}: {
  title: string;
  language: string;
  content: string;
  missingNote?: React.ReactNode;
  collapsible?: boolean;
}) {
  const [openPreview, setOpenPreview] = useState(!collapsible);
  return (
    <Flex direction="column" gap="1">
      <Flex align="center" gap="2" style={{ flexWrap: 'wrap' }}>
        <Text variant="body-small" color="secondary">
          {title}
        </Text>
        {collapsible && (
          <Button
            variant="tertiary"
            size="small"
            onPress={() => setOpenPreview(o => !o)}
          >
            {openPreview ? 'hide' : 'show'}
          </Button>
        )}
        <Badge size="small">{language}</Badge>
        {missingNote}
      </Flex>
      {openPreview && <CodeBlock text={content} language={language} />}
    </Flex>
  );
}

function Field({
  field,
  value,
  onChange,
}: {
  field: HireField;
  value: string;
  onChange: (value: string) => void;
}) {
  const common = {
    label: field.label,
    description: field.help,
    isRequired: field.required,
  };
  if (field.type === 'select') {
    return (
      <Select
        {...common}
        options={(field.options ?? []).map(o => ({ id: o, label: o }))}
        value={value || null}
        onChange={key => onChange(key === null ? '' : String(key))}
      />
    );
  }
  if (field.type === 'textarea') {
    return (
      <TextAreaField {...common} rows={4} value={value} onChange={onChange} />
    );
  }
  if (field.type === 'number') {
    return (
      <NumberField
        {...common}
        value={
          value === '' || Number.isNaN(Number(value)) ? NaN : Number(value)
        }
        onChange={n => onChange(Number.isNaN(n) ? '' : String(n))}
      />
    );
  }
  return (
    <TextField
      {...common}
      type={field.type === 'url' ? 'url' : 'text'}
      value={value}
      onChange={onChange}
    />
  );
}

/** @public */
export function HireAgentDialog({
  agent,
  open,
  onClose,
  onInvoke,
}: HireAgentDialogProps) {
  const fields = useMemo(() => agent?.hireSchema ?? [], [agent]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [turns, setTurns] = useState<Turn[]>([]);
  const [running, setRunning] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followUp, setFollowUp] = useState('');
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [showPreview, setShowPreview] = useState(false);
  // Bumped whenever the dialog opens/closes or switches agent, so a
  // still-in-flight run() from a previous agent/open can't clobber state
  // that now belongs to a different one.
  const requestTokenRef = useRef(0);

  useEffect(() => {
    requestTokenRef.current += 1;
    if (open && fields.length) {
      setValues(buildInitialState(fields));
      setTurns([]);
      setError(null);
      setRunning(false);
      setPublishing(false);
      setFollowUp('');
      setThreadId(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, agent?.entityRef]);

  const missing = useMemo(
    () => (fields.length ? isRequiredMissing(fields, values) : false),
    [fields, values],
  );

  const filledPrompt = useMemo(() => {
    if (!agent) return '';
    if (agent.promptTemplate) return fillTemplate(agent.promptTemplate, values);
    return JSON.stringify(values, null, 2);
  }, [agent, values]);

  const payload = useMemo(() => buildPayload(filledPrompt), [filledPrompt]);

  const sessionId = useMemo(makeSessionId, [agent?.entityRef, open]);

  // The CLI preview below is AgentCore-specific (`aws bedrock-agentcore
  // invoke-agent-runtime`) — showing it for other runtimes (kagent, litellm,
  // custom...) would be actively misleading, since those don't take a
  // region/runtime-handle pair and aren't invocable that way at all.
  const isAgentCoreRuntime = agent?.runtime.runtime === 'bedrock-agentcore';

  const cliCommand = useMemo(
    () => (agent ? buildCliCommand(agent, payload, sessionId) : ''),
    [agent, payload, sessionId],
  );

  const payloadJson = useMemo(
    () => JSON.stringify(payload, null, 2),
    [payload],
  );

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  const lastTurn = turns[turns.length - 1];
  const canPublish =
    !!onInvoke &&
    !!lastTurn?.result &&
    !lastTurn.post &&
    agent?.runtime.runtime === 'bedrock-agentcore' &&
    !!agent?.hireSchema?.some(f => f.name === 'action' || f.name === 'post');

  const run = async (opts: { prompt?: string; post?: boolean } = {}) => {
    if (!onInvoke) return;
    const token = requestTokenRef.current;
    setRunning(true);
    setError(null);
    const id = `turn-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const promptText = opts.prompt ?? filledPrompt;
    const turn: Turn = { id, prompt: promptText, post: opts.post ?? false };
    setTurns(prev => [...prev, turn]);
    try {
      const res = await onInvoke(values, {
        threadId,
        post: opts.post ?? false,
        ...(opts.prompt ? { prompt: opts.prompt } : {}),
      });
      if (requestTokenRef.current === token) {
        if (res.threadId) setThreadId(res.threadId);
        setTurns(prev =>
          prev.map(t =>
            t.id === id ? { ...t, result: res, post: res.post ?? t.post } : t,
          ),
        );
      }
    } catch (err: any) {
      const message = err?.message ?? 'invocation failed';
      if (requestTokenRef.current === token) {
        setError(message);
        setTurns(prev =>
          prev.map(t => (t.id === id ? { ...t, error: message } : t)),
        );
      }
    } finally {
      if (requestTokenRef.current === token) setRunning(false);
    }
  };

  const confirmAndPublish = async () => {
    if (!onInvoke) return;
    setPublishing(true);
    try {
      await run({ post: true });
    } finally {
      setPublishing(false);
    }
  };

  const sendFollowUp = async () => {
    const text = followUp.trim();
    if (!text) return;
    setFollowUp('');
    await run({ prompt: text });
  };

  if (!agent || !fields.length) return null;

  const busy = running || publishing;
  const lastTurnId = turns[turns.length - 1]?.id;

  return (
    <Dialog
      isOpen={open}
      onOpenChange={isOpen => {
        if (!isOpen) onClose();
      }}
      width={760}
    >
      <DialogHeader>Run {agent.title ?? agent.name}</DialogHeader>
      <DialogBody>
        <Flex direction="column" gap="5">
          {/* Parameters — only relevant for the first (dry) turn. */}
          {!turns.length && (
            <Flex direction="column" gap="3">
              <Text as="h3" variant="body-medium" weight="bold">
                Invocation parameters
              </Text>
              {fields.map(f => (
                <Field
                  key={f.name}
                  field={f}
                  value={values[f.name] ?? ''}
                  onChange={v => setValues(prev => ({ ...prev, [f.name]: v }))}
                />
              ))}
              <Text variant="body-small" color="secondary">
                Runs in dry-run by default — the agent reports back without
                posting anything. You confirm afterwards.
              </Text>
            </Flex>
          )}

          {/* Conversation turns */}
          {turns.map(t => (
            <Flex key={t.id} direction="column" gap="2">
              <Text variant="body-small" color="secondary">
                {t.post ? 'You (publish)' : 'You'}
              </Text>
              <div
                style={{
                  padding: 'var(--bui-space-3)',
                  background: 'var(--bui-bg-neutral-2)',
                  borderRadius: 'var(--bui-radius-2)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <Text variant="body-medium">{t.prompt}</Text>
              </div>
              {t.result && (
                <Flex direction="column" gap="1">
                  <Flex align="center" gap="2">
                    <Text variant="body-small" color="secondary">
                      {agent.title ?? agent.name}
                      {t.post ? ' · published' : ' · dry-run'}
                    </Text>
                    {t.result.latencyMs !== undefined &&
                      t.result.latencyMs !== null && (
                        <Badge size="small">{`${(t.result.latencyMs / 1000).toFixed(1)}s`}</Badge>
                      )}
                  </Flex>
                  <PreviewBlock
                    title={`session ${t.result.sessionId}`}
                    language="text"
                    content={t.result.responseText || '(empty response)'}
                  />
                </Flex>
              )}
              {t.error && (
                <Text
                  variant="body-medium"
                  color="danger"
                  style={{ whiteSpace: 'pre-wrap' }}
                >
                  {t.error}
                </Text>
              )}
              {running && lastTurnId === t.id && (
                <Flex align="center" gap="2">
                  <StatusDot tone="info" pulse />
                  <Text variant="body-small" color="secondary">
                    Running — reviews can take a few minutes…
                  </Text>
                </Flex>
              )}
            </Flex>
          ))}

          {error && !turns.length && (
            <Alert status="danger" icon title={error} />
          )}

          {/* Confirm and publish — second, explicit step after a dry run. */}
          {canPublish && (
            <Alert
              status="warning"
              icon
              title="This is a dry-run"
              description="The result above has not been posted. Publish it to write the feedback to the target system."
              customActions={
                <Button
                  variant="primary"
                  size="small"
                  iconStart={<RiUploadCloud2Line size={16} />}
                  isPending={publishing}
                  isDisabled={busy}
                  onPress={confirmAndPublish}
                >
                  Confirm and publish
                </Button>
              }
            />
          )}

          {/* Follow-up composer (conversational multi-turn). */}
          {!!turns.length && onInvoke && (
            <TextAreaField
              aria-label="Follow-up message"
              placeholder="Follow-up message — the agent keeps the conversation context"
              rows={3}
              value={followUp}
              onChange={setFollowUp}
              isDisabled={busy}
            />
          )}

          {/* Invocation preview (available before the first run). */}
          {!turns.length && (
            <Flex direction="column" gap="2" align="start">
              <Button
                variant="tertiary"
                size="small"
                onPress={() => setShowPreview(s => !s)}
              >
                {showPreview
                  ? 'Hide invocation preview'
                  : 'Show invocation preview'}
              </Button>
              {showPreview && (
                <Flex direction="column" gap="3" style={{ width: '100%' }}>
                  <PreviewBlock
                    title="Prompt"
                    language="text"
                    content={filledPrompt}
                  />
                  <PreviewBlock
                    title="Payload (POST /invocations)"
                    language="json"
                    content={payloadJson}
                  />
                  {isAgentCoreRuntime && (
                    <PreviewBlock
                      title="AWS CLI command (preview — actual session id assigned at run time)"
                      language="bash"
                      content={cliCommand}
                      missingNote={
                        !agent.runtime.region ||
                        !agent.runtime.runtimeHandle ? (
                          <Badge
                            size="small"
                            style={{
                              background: TONE_BG.warning,
                              color: TONE_FG.warning,
                            }}
                          >
                            missing region/runtime-handle — set the annotations
                          </Badge>
                        ) : undefined
                      }
                    />
                  )}
                </Flex>
              )}
            </Flex>
          )}
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Button variant="secondary" onPress={onClose}>
          Close
        </Button>
        {!onInvoke && isAgentCoreRuntime && (
          <Button
            variant="primary"
            isDisabled={missing}
            onPress={() => copy(cliCommand)}
            iconStart={<RiFileCopyLine size={16} />}
          >
            Copy CLI command
          </Button>
        )}
        {onInvoke && (
          <>
            {!turns.length && isAgentCoreRuntime && (
              <Button
                variant="secondary"
                onPress={() => copy(cliCommand)}
                iconStart={<RiFileCopyLine size={16} />}
              >
                Copy CLI
              </Button>
            )}
            {!turns.length && (
              <Button
                variant="primary"
                isDisabled={missing || busy}
                isPending={running}
                onPress={() => run()}
                iconStart={<RiPlayLine size={16} />}
              >
                Run agent
              </Button>
            )}
            {!!turns.length && (
              <Button
                variant="primary"
                isDisabled={busy || !followUp.trim()}
                isPending={running}
                onPress={sendFollowUp}
                iconStart={<RiSendPlaneLine size={16} />}
              >
                Send
              </Button>
            )}
          </>
        )}
      </DialogFooter>
    </Dialog>
  );
}
