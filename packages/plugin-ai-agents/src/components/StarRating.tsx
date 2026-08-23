import React from 'react';
import { Box, Fade, Rating, Typography } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';

export type StarVariant = 'simple' | 'fancy';

const LABELS = ['Poor', 'Fair', 'Good', 'Great', 'Excellent'];

interface StarRatingProps {
  value: number;
  /** Controlled change handler; omit for read-only display. */
  onChange?: (value: number) => void;
  variant?: StarVariant;
}

/**
 * 0-5 star rating widget.
 * - `simple`: compact read-mostly stars (cards, rows).
 * - `fancy`: interactive large stars with hover animation and labels
 *   (review forms).
 */
export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  variant = 'simple',
}) => {
  if (variant === 'simple') {
    return (
      <Rating
        name="star-rating-simple"
        value={value}
        precision={0.5}
        readOnly={!onChange}
        onChange={(_, v) => onChange?.(v ?? 0)}
        size="small"
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Rating
        name="star-rating-fancy"
        value={value}
        precision={1}
        onChange={(_, v) => onChange?.(v ?? 0)}
        size="large"
        icon={
          <StarIcon
            fontSize="inherit"
            sx={{
              color: 'warning.main',
              transition: theme =>
                `transform ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeInOut}`,
              filter: 'drop-shadow(0 2px 4px rgba(255, 152, 0, 0.45))',
            }}
          />
        }
        sx={{
          fontSize: 34,
          '& .MuiRating-icon': {
            transition: theme =>
              `transform ${theme.transitions.duration.short}ms ${theme.transitions.easing.easeInOut}`,
          },
          '& .MuiRating-iconHover': { transform: 'scale(1.25) rotate(-8deg)' },
        }}
      />
      <Fade in={value > 0}>
        <Typography variant="body2" fontWeight={600} sx={{ minWidth: 60 }}>
          {value > 0 ? LABELS[value - 1] : ''}
        </Typography>
      </Fade>
    </Box>
  );
};
