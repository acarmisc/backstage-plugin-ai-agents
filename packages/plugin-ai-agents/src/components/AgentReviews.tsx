import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Flex, Text, TextAreaField } from '@backstage/ui';
import { RiSendPlaneLine } from '@remixicon/react';
import { useApi } from '@backstage/core-plugin-api';
import { aiAgentsApiRef } from '../api';
import type { AgentReview, ReviewsSummary } from '../types';
import { TONE_FG } from '../ui';
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

function ReviewRow({ review }: { review: AgentReview }) {
  return (
    <li
      style={{
        listStyle: 'none',
        padding: 'var(--bui-space-2) 0',
        borderBottom: '1px solid var(--bui-border-1)',
      }}
    >
      <Flex align="center" gap="2">
        <StarRating value={review.rating} />
        <Text
          variant="body-small"
          color="secondary"
          style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
        >
          {review.userRef?.split('/').pop() ?? 'anonymous'} ·{' '}
          {formatWhen(review.createdAt)}
        </Text>
      </Flex>
      {review.comment && (
        <Text
          as="p"
          variant="body-medium"
          style={{ margin: 'var(--bui-space-1) 0 0', whiteSpace: 'pre-wrap' }}
        >
          {review.comment}
        </Text>
      )}
    </li>
  );
}

/**
 * Agent reviews: average rating, review list and a "Rate this agent" form
 * with the fancy star widget. Renders nothing while there is nothing yet
 * and no database behind it.
 *
 * @public
 */
export function AgentReviews({
  entityRef,
  limit = 50,
}: {
  entityRef: string;
  limit?: number;
}) {
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
      await api.addReview(entityRef, {
        rating,
        comment: comment.trim() || undefined,
      });
      setRating(0);
      setComment('');
      setSubmitted(true);
      api
        .getReviews(entityRef, limit)
        .then(setSummary)
        .catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Flex direction="column" gap="3" data-testid="agent-reviews">
      <Flex align="baseline" gap="2">
        <Text as="h3" variant="body-medium" weight="bold">
          Reviews
        </Text>
        <Text variant="body-small" color="secondary">
          ({summary.count}) · avg {summary.average ?? '—'}/5
        </Text>
      </Flex>

      <StarRating value={summary.average ?? 0} />

      {summary.reviews.length > 0 && (
        <ul style={{ margin: 0, padding: 0 }}>
          {summary.reviews.map(r => (
            <ReviewRow key={r.id ?? `${r.userRef}-${r.createdAt}`} review={r} />
          ))}
        </ul>
      )}

      {!submitted ? (
        <Flex
          direction="column"
          gap="3"
          p="3"
          style={{
            border: '1px dashed var(--bui-border-2)',
            borderRadius: 'var(--bui-radius-3)',
          }}
        >
          <Text variant="body-medium" weight="bold">
            Rate this agent
          </Text>
          <StarRating variant="fancy" value={rating} onChange={setRating} />
          <TextAreaField
            aria-label="Review"
            placeholder="Write a short review (optional)"
            rows={3}
            maxLength={2000}
            value={comment}
            onChange={setComment}
          />
          {error && <Alert status="danger" title={error} />}
          <div>
            <Button
              variant="primary"
              size="small"
              iconStart={<RiSendPlaneLine size={16} />}
              isPending={submitting}
              isDisabled={rating < 1 || submitting}
              onPress={submit}
            >
              Submit review
            </Button>
          </div>
        </Flex>
      ) : (
        <Text variant="body-medium" style={{ color: TONE_FG.success }}>
          Thanks! Your review was submitted.
        </Text>
      )}
    </Flex>
  );
}
