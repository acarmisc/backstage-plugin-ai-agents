import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SendIcon from '@mui/icons-material/Send';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { AgentReview, ReviewsSummary } from '../types';
import { StarRating } from './StarRating';

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

const ReviewRow: React.FC<{ review: AgentReview }> = ({ review }) => (
  <Box
    sx={{
      py: 0.75,
      borderBottom: '1px solid',
      borderColor: 'divider',
      '&:last-child': { borderBottom: 'none' },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <StarRating value={review.rating} />
      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }} whiteSpace="nowrap">
        {review.userRef?.split('/').pop() ?? 'anonymous'} · {formatWhen(review.createdAt)}
      </Typography>
    </Box>
    {review.comment && (
      <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
        {review.comment}
      </Typography>
    )}
  </Box>
);

/**
 * Agent reviews: average rating, review list and a "Rate this agent" form
 * with the fancy star widget. Renders nothing while there is nothing yet
 * and no database behind it.
 */
export const AgentReviews: React.FC<{
  entityRef: string;
  limit?: number;
}> = ({ entityRef, limit = 50 }) => {
  const api = useApi(aiAgentsApiRef);
  const [summary, setSummary] = useState<ReviewsSummary | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    let alive = true;
    api
      .getReviews(entityRef, limit)
      .then(s => alive && setSummary(s))
      // No backend/database — keep the section hidden rather than noisy.
      .catch(() => alive && setSummary(null));
    return () => {
      alive = false;
    };
  }, [api, entityRef, limit]);

  useEffect(() => reload(), [reload]);

  if (!summary) return null;

  const submit = async () => {
    if (rating < 1 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.addReview(entityRef, { rating, comment: comment.trim() || undefined });
      setRating(0);
      setComment('');
      setSubmitted(true);
      api.getReviews(entityRef, limit).then(setSummary).catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box data-testid="agent-reviews" sx={{ mt: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        Reviews{' '}
        <Typography component="span" variant="caption" color="text.secondary">
          ({summary.count}) · avg {summary.average ?? '—'}/5
        </Typography>
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <StarRating value={summary.average ?? 0} />
      </Box>

      <Stack>
        {summary.reviews.map(r => (
          <ReviewRow key={r.id ?? `${r.userRef}-${r.createdAt}`} review={r} />
        ))}
      </Stack>

      {!submitted ? (
        <Box sx={{ mt: 2, p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Rate this agent
          </Typography>
          <StarRating variant="fancy" value={rating} onChange={setRating} />
          <TextField
            size="small"
            fullWidth
            multiline
            minRows={2}
            placeholder="Write a short review (optional)"
            value={comment}
            onChange={e => setComment(e.target.value)}
            inputProps={{ maxLength: 2000 }}
            sx={{ mt: 1 }}
          />
          {error && (
            <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
              {error}
            </Typography>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={
              submitting ? <CircularProgress size={14} color="inherit" /> : <SendIcon />
            }
            disabled={rating < 1 || submitting}
            onClick={submit}
            sx={{ mt: 1 }}
          >
            Submit review
          </Button>
        </Box>
      ) : (
        <Typography variant="body2" color="success.main" sx={{ mt: 1 }}>
          Thanks! Your review was submitted.
        </Typography>
      )}
    </Box>
  );
};
