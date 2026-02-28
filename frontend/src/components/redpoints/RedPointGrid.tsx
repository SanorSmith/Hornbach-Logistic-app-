import { RedPoint } from '../../types';
import RedPointCard from './RedPointCard';
import { motion } from 'framer-motion';

interface RedPointGridProps {
  points: RedPoint[];
  onPointClick: (point: RedPoint) => void;
  assignments?: Record<string, string>;
}

export default function RedPointGrid({ points, onPointClick, assignments }: RedPointGridProps) {
  const sortedPoints = [...points].sort((a, b) => {
    const priority = { KUNDORDER: 0, SKRAP: 1, UPPTAGEN: 2, LEDIG: 3 };
    return priority[a.status] - priority[b.status];
  });

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
        />
      ))}
    </motion.div>
  );
}
