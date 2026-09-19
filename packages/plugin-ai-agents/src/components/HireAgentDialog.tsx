import React, { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SendIcon from '@mui/icons-material/Send';
import PublishIcon from '@mui/icons-material/Publish';
import type { InvocationResult } from '../api';
import type { AiAgent, HireField } from '../types';

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

const PreviewBlock: React.FC<{
  title: string;
  language: string;
  content: string;
  onCopy: () => void;
  missingChip?: React.ReactNode;
  collapsible?: boolean;
}> = ({ title, language, content, onCopy, missingChip, collapsible }) => {
  const [openPreview, setOpenPreview] = useState(!collapsible);
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {title}
        </Typography>
        {collapsible && (
          <Button size="small" onClick={() => setOpenPreview(o => !o)} sx={{ ml: 1, minWidth: 0 }}>
            {openPreview ? 'hide' : 'show'}
          </Button>
        )}
        <Chip
          size="small"
          label={language}
          sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
        />
        {missingChip}
        <IconButton
          size="small"
          onClick={onCopy}
          sx={{ ml: 'auto' }}
          title="Copy"
        >
          <ContentCopyIcon fontSize="inherit" />
        </IconButton>
      </Box>
      {openPreview && (
        <Box
          component="pre"
          sx={{
            m: 0,
            p: 1.25,
            bgcolor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            overflowX: 'auto',
            maxHeight: 260,
          }}
        >
          {content}
        </Box>
      )}
    </Box>
  );
};

export const HireAgentDialog: React.FC<HireAgentDialogProps> = ({
  agent,
  open,
  onClose,
  onInvoke,
}) => {
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

  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

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
          prev.map(t => (t.id === id ? { ...t, result: res, post: res.post ?? t.post } : t)),
        );
      }
    } catch (err: any) {
      const message = err?.message ?? 'invocation failed';
      if (requestTokenRef.current === token) {
        setError(message);
        setTurns(prev => prev.map(t => (t.id === id ? { ...t, error: message } : t)));
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Run {agent.title ?? agent.name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Parameters — only relevant for the first (dry) turn. */}
          {!turns.length && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Invocation parameters
              </Typography>
              <Stack spacing={2}>
                {fields.map(f => {
                  const value = values[f.name] ?? '';
                  const onChange = (v: string) =>
                    setValues(prev => ({ ...prev, [f.name]: v }));
                  const fieldError = f.required && !value.trim();
                  const common = {
                    key: f.name,
                    label: f.label,
                    required: f.required,
                    error: fieldError,
                    helperText:
                      f.help ?? (fieldError ? 'This field is required' : undefined),
                    value,
                    size: 'small' as const,
                    fullWidth: true,
                  };
                  if (f.type === 'select') {
                    return (
                      <TextField
                        {...common}
                        select
                        onChange={e => onChange(e.target.value)}
                      >
                        {(f.options ?? []).map(opt => (
                          <MenuItem key={opt} value={opt}>
                            {opt}
                          </MenuItem>
                        ))}
                      </TextField>
                    );
                  }
                  if (f.type === 'textarea') {
                    return (
                      <TextField
                        {...common}
                        multiline
                        minRows={3}
                        onChange={e => onChange(e.target.value)}
                      />
                    );
                  }
                  if (f.type === 'number') {
                    return (
                      <TextField
                        {...common}
                        type="number"
                        onChange={e => onChange(e.target.value)}
                      />
                    );
                  }
                  return (
                    <TextField
                      {...common}
                      type={f.type === 'url' ? 'url' : 'text'}
                      onChange={e => onChange(e.target.value)}
                    />
                  );
                })}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                Runs in dry-run by default — the agent reports back without
                posting anything. You confirm afterwards.
              </Typography>
            </Box>
          )}

          {/* Conversation turns */}
          <Stack spacing={2}>
            {turns.map(t => (
              <Box key={t.id}>
                <Typography variant="caption" color="text.secondary">
                  {t.post ? 'You (publish)' : 'You'}
                </Typography>
                <Box
                  sx={{
                    p: 1.25,
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontSize: '0.85rem',
                  }}
                >
                  {t.prompt}
                </Box>
                {t.result && (
                  <Box sx={{ mt: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {agent.title ?? agent.name}
                        {t.post ? ' · published' : ' · dry-run'}
                      </Typography>
                      {t.result.latencyMs !== undefined && t.result.latencyMs !== null && (
                        <Chip
                          size="small"
                          label={`${(t.result.latencyMs / 1000).toFixed(1)}s`}
                          sx={{ ml: 1, height: 18, fontSize: '0.65rem' }}
                        />
                      )}
                      <IconButton
                        size="small"
                        onClick={() => copy(t.result!.responseText)}
                        sx={{ ml: 'auto' }}
                        title="Copy"
                      >
                        <ContentCopyIcon fontSize="inherit" />
                      </IconButton>
                    </Box>
                    <PreviewBlock
                      title={`session ${t.result.sessionId}`}
                      language="text"
                      content={t.result.responseText || '(empty response)'}
                      onCopy={() => copy(t.result!.responseText)}
                    />
                  </Box>
                )}
                {t.error && (
                  <Typography variant="body2" color="error" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                    {t.error}
                  </Typography>
                )}
                {running && turns[turns.length - 1]?.id === t.id && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="caption" color="text.secondary">
                      Running — reviews can take a few minutes…
                    </Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Stack>

          {error && !turns.length && (
            <Typography variant="body2" color="error" sx={{ whiteSpace: 'pre-wrap' }}>
              {error}
            </Typography>
          )}

          {/* Confirm and publish — second, explicit step after a dry run. */}
          {canPublish && (
            <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'warning.main', borderRadius: 1 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                The result above is a dry-run and has not been posted. Publish
                it to write the feedback to the target system.
              </Typography>
              <Button
                variant="contained"
                color="warning"
                startIcon={publishing ? <CircularProgress size={16} color="inherit" /> : <PublishIcon />}
                disabled={busy}
                onClick={confirmAndPublish}
              >
                Confirm and publish
              </Button>
            </Box>
          )}

          {/* Follow-up composer (conversational multi-turn). */}
          {!!turns.length && onInvoke && (
            <Box>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                placeholder="Follow-up message — the agent keeps the conversation context"
                value={followUp}
                onChange={e => setFollowUp(e.target.value)}
                disabled={busy}
              />
            </Box>
          )}

          {/* Invocation preview (available before the first run). */}
          {!turns.length && (
            <Box>
              <Button size="small" onClick={() => setShowPreview(s => !s)}>
                {showPreview ? 'Hide invocation preview' : 'Show invocation preview'}
              </Button>
              {showPreview && (
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  <PreviewBlock
                    title="Prompt"
                    language="text"
                    content={filledPrompt}
                    onCopy={() => copy(filledPrompt)}
                  />
                  <PreviewBlock
                    title="Payload (POST /invocations)"
                    language="json"
                    content={payloadJson}
                    onCopy={() => copy(payloadJson)}
                  />
                  {isAgentCoreRuntime && (
                    <PreviewBlock
                      title="AWS CLI command (preview — actual session id assigned at run time)"
                      language="bash"
                      content={cliCommand}
                      onCopy={() => copy(cliCommand)}
                      missingChip={
                        !agent.runtime.region || !agent.runtime.runtimeHandle ? (
                          <Chip
                            size="small"
                            color="warning"
                            label="missing region/runtime-handle — set the annotations"
                            sx={{ ml: 1 }}
                          />
                        ) : undefined
                      }
                    />
                  )}
                </Stack>
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {!onInvoke && isAgentCoreRuntime && (
          <Button
            variant="contained"
            disabled={missing}
            onClick={() => copy(cliCommand)}
            startIcon={<ContentCopyIcon />}
          >
            Copy CLI command
          </Button>
        )}
        {onInvoke && (
          <>
            {!turns.length && isAgentCoreRuntime && (
              <Button onClick={() => copy(cliCommand)} startIcon={<ContentCopyIcon />}>
                Copy CLI
              </Button>
            )}
            {!turns.length && (
              <Button
                variant="contained"
                disabled={missing || busy}
                onClick={() => run()}
                startIcon={
                  running ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />
                }
              >
                Run agent
              </Button>
            )}
            {!!turns.length && (
              <Button
                variant="contained"
                disabled={busy || !followUp.trim()}
                onClick={sendFollowUp}
                startIcon={
                  running ? <CircularProgress size={16} color="inherit" /> : <SendIcon />
                }
              >
                Send
              </Button>
            )}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};
