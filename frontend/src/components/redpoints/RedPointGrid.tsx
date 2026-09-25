import { RedPoint } from '../../types';
import RedPointCard from './RedPointCard';
import { motion } from 'framer-motion';
import { sortPointsForDisplay, useNow } from '../../lib/pointAge';

interface RedPointGridProps {
  points: RedPoint[];
  onPointClick: (point: RedPoint) => void;
  assignments?: Record<string, string>;
}

export default function RedPointGrid({ points, onPointClick, assignments }: RedPointGridProps) {
  const now = useNow();
  // Kundorder, Skräp, Upptagen (oldest first), Ledig.
  const sortedPoints = sortPointsForDisplay(points);

  return (
    <motion.div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: 0.05,
          },
        },
      }}
    >
      {sortedPoints.map((point) => (
        <RedPointCard
          key={point.id}
          point={point}
          onClick={() => onPointClick(point)}
          assignments={assignments}
          now={now}
        />
      ))}
    </motion.div>
  );
}
