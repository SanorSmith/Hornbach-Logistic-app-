import { X } from 'lucide-react';
import { RedPoint } from '../../types';
import { getStatusLabel } from '../../utils/statusColors';
import StatusCircle from './StatusCircle';
import PointImageGallery from './PointImageGallery';

interface PointImagesViewerProps {
  point: RedPoint;
  label: string;
  onClose: () => void;
}

/** Read-only view of a point's latest photos and notes (Monitor dashboard). */
export default function PointImagesViewer({ point, label, onClose }: PointImagesViewerProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
    >
      <div
        className="bg-white text-gray-800 rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-2xl font-bold">Punkt {label}</h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusCircle status={point.status} />
              <span className="text-sm text-gray-600">{getStatusLabel(point.status)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition"
            aria-label="Stäng"
          >
            <X size={24} />
          </button>
        </div>

        <PointImageGallery pointId={point.id} large />
      </div>
    </div>
  );
}
