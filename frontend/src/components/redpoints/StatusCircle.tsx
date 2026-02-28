import { motion } from 'framer-motion';
import { PointStatus } from '../../types';
import { getStatusColor } from '../../utils/statusColors';

interface StatusCircleProps {
  status: PointStatus;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export default function StatusCircle({ 
  status, 
  size = 'md',
  animated = true 
}: StatusCircleProps) {
  const sizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-6 h-6',
  };

  const Circle = animated ? motion.div : 'div';

  const animationProps = animated && status === 'KUNDORDER' ? {
    animate: {
      scale: [1, 1.2, 1],
      opacity: [1, 0.7, 1],
    },
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  } : {};

  return (
    <Circle
      className={`${sizes[size]} rounded-full ${getStatusColor(status)}`}
      {...animationProps}
    />
  );
}
