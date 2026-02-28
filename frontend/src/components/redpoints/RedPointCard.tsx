import { motion } from 'framer-motion';
import { RedPoint } from '../../types';
import { getStatusColor, getStatusLabel } from '../../utils/statusColors';
import StatusCircle from './StatusCircle';
import { MapPin, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { sv } from 'date-fns/locale';

interface RedPointCardProps {
  point: RedPoint;
  onClick: () => void;
  assignments?: Record<string, string>;
}

export default function RedPointCard({ point, onClick, assignments }: RedPointCardProps) {
  const statusColor = getStatusColor(point.status);
  const isPriority = point.status === 'KUNDORDER';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`
        relative bg-white rounded-lg shadow-sm border-2 p-4 cursor-pointer
        transition-all hover:shadow-md
        ${isPriority ? 'border-kundorder ring-2 ring-kundorder ring-opacity-50' : 'border-gray-200'}
      `}
    >
      {isPriority && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="absolute -top-2 -right-2 bg-kundorder text-white text-xs font-bold px-2 py-1 rounded-full"
        >
          PRIORITET
        </motion.div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <StatusCircle status={point.status} size="lg" />
          <div>
            <h3 className="text-2xl font-bold text-gray-800">
              {assignments && assignments[point.id] ? assignments[point.id] : `#${point.point_number}`}
            </h3>
            <p className="text-xs text-gray-400">Point ID: {point.id}</p>
            <p className="text-xs text-gray-400">Assignment: {assignments?.[point.id] || 'NONE'}</p>
            <p className="text-xs text-gray-500">
              {getStatusLabel(point.status)}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
        <MapPin size={16} />
        <span>{point.department?.name}</span>
      </div>

      {point.current_user && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <User size={16} />
          <span>{point.current_user.full_name}</span>
        </div>
      )}

      <div className="text-xs text-gray-400 mt-3">
        Uppdaterad {formatDistanceToNow(new Date(point.last_updated), {
          addSuffix: true,
          locale: sv,
        })}
      </div>

      <div className={`absolute bottom-0 left-0 right-0 h-1 ${statusColor} rounded-b-lg`} />
    </motion.div>
  );
}
