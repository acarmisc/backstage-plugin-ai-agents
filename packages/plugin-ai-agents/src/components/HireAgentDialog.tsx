import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import type { AiAgent, HireField } from '../types';

export interface HireAgentDialogProps {
  agent: AiAgent | null;
  open: boolean;
  onClose: () => void;
}

const fieldDefault = (f: HireField): string => f.default ?? '';

const buildInitialState = (fields: HireField[]): Record<string, string> =>
  Object.fromEntries(fields.map(f => [f.name, fieldDefault(f)]));

const isRequiredMissing = (
  fields: HireField[],
  values: Record<string, string>,
) => fields.some(f => f.required && !values[f.name]?.trim());

/** Replace {name} placeholders in `template` with `values[name]`. */
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
    `--region ${region}`,
    `--agent-runtime-identifier "${handle}"`,
    `--runtime-session-id "${sessionId}"`,
    `--payload '${body}'`,
  ].join(' \\\n  ');
}

export const HireAgentDialog: React.FC<HireAgentDialogProps> = ({
  agent,
  open,
  onClose,
}) => {
  const fields = agent?.hireSchema ?? [];
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && fields.length) {
      setValues(buildInitialState(fields));
    }
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

  const sessionId = useMemo(
    () => `hire-${Date.now().toString(36)}`,
    [agent?.entityRef, open],
  );

  const cliCommand = useMemo(
    () => (agent ? buildCliCommand(agent, payload, sessionId) : ''),
    [agent, payload, sessionId],
  );

  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
  };

  if (!agent || !fields.length) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Hire {agent.title ?? agent.name}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {/* Form */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Invocation parameters
            </Typography>
            <Stack spacing={2}>
              {fields.map(f => {
                const value = values[f.name] ?? '';
                const onChange = (v: string) =>
                  setValues(prev => ({ ...prev, [f.name]: v }));
                const error = f.required && !value.trim();
                const common = {
                  key: f.name,
                  label: f.label,
                  required: f.required,
                  error,
                  helperText:
                    f.help ?? (error ? 'This field is required' : undefined),
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
          </Box>

          {/* Live preview */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Invocation preview
            </Typography>
            <Stack spacing={1.5}>
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
              <PreviewBlock
                title="AWS CLI command"
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
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          disabled={missing}
          onClick={() => copy(cliCommand)}
          startIcon={<ContentCopyIcon />}
        >
          Copy CLI command
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const PreviewBlock: React.FC<{
  title: string;
  language: string;
  content: string;
  onCopy: () => void;
  missingChip?: React.ReactNode;
}> = ({ title, language, content, onCopy, missingChip }) => (
  <Box>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        mb: 0.5,
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
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
        maxHeight: 220,
      }}
    >
      {content}
    </Box>
  </Box>
);