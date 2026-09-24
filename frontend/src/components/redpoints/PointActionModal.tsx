import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RedPoint, PointStatus } from '../../types';
import { X, Package, Trash2, CheckCircle, Camera, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadPointImage } from '../../lib/pointImages';
import PointImageGallery from './PointImageGallery';
import { usePointDetails } from '../../hooks/usePointDetails';
import { getStatusLabel } from '../../utils/statusColors';
import StatusCircle from './StatusCircle';

interface PointActionModalProps {
  point: RedPoint;
  onClose: () => void;
  onUpdateStatus: (status: PointStatus, notes?: string) => Promise<void>;
  allowedActions: PointStatus[];
  /** Actions shown but not clickable on this page (e.g. UPPTAGEN on Avdelning). */
  disabledActions?: PointStatus[];
  /** Allow deleting photos from the gallery (LineFeeder only). */
  canDeleteImages?: boolean;
}

export default function PointActionModal({
  point,
  onClose,
  onUpdateStatus,
  allowedActions,
  disabledActions = [],
  canDeleteImages = false,
}: PointActionModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notes, setNotes] = useState('');
  const cameraInput = useRef<HTMLInputElement>(null);
  const details = usePointDetails(point);

  const handleUpdateStatus = async (newStatus: PointStatus) => {
    // Marking as UPPTAGEN requires a photo: open the camera first.
    if (newStatus === 'UPPTAGEN') {
      cameraInput.current?.click();
      return;
    }
    setIsUpdating(true);
    await onUpdateStatus(newStatus, notes || undefined);
    setIsUpdating(false);
    onClose();
  };

  const handlePhotoTaken = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow taking the same photo again
    if (!file) return; // camera cancelled - status is not changed

    setIsUpdating(true);
    setIsUploading(true);
    try {
      await uploadPointImage(point.id, file, notes);
    } catch (error) {
      console.error('Error uploading point image:', error);
      toast.error('Kunde inte spara bilden. Status ändrades inte.');
      setIsUpdating(false);
      setIsUploading(false);
      return;
    }
    setIsUploading(false);

    const savedNote = notes;
    setNotes(''); // the note is stored with the photo; start empty next time
    await onUpdateStatus('UPPTAGEN', savedNote || undefined);
    setIsUpdating(false);
    onClose();
  };

  const getActionButton = (status: PointStatus) => {
    const configs = {
      LEDIG: {
        icon: CheckCircle,
        label: 'Markera som Ledig',
        color: 'bg-ledig hover:bg-ledig-dark',
      },
      UPPTAGEN: {
        icon: Camera,
        label: 'Markera som Upptagen',
        color: 'bg-upptagen hover:bg-upptagen-dark',
      },
      SKRAP: {
        icon: Trash2,
        label: 'Plocka Skräp',
        color: 'bg-skrap hover:bg-skrap-dark',
      },
      KUNDORDER: {
        icon: Package,
        label: 'Plocka Kundorder',
        color: 'bg-kundorder hover:bg-kundorder-dark',
      },
    };

    const config = configs[status];
    const Icon = config.icon;
    const isDisabled = disabledActions.includes(status);

    return (
      <button
        key={status}
        onClick={() => handleUpdateStatus(status)}
        disabled={isUpdating || isDisabled}
        title={isDisabled ? 'Inte tillgänglig på den här sidan' : undefined}
        className={`
          w-full py-3 px-4 rounded-lg text-white font-semibold
          flex items-center justify-center gap-2
          transition-all transform hover:scale-105
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
          ${config.color}
        `}
      >
        {status === 'UPPTAGEN' && isUploading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Sparar bild...
          </>
        ) : (
          <>
            <Icon size={20} />
            {config.label}
          </>
        )}
      </button>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Punkt {details.name ?? `#${point.point_number}`}
              </h2>
              <div className="flex items-center gap-2">
                <StatusCircle status={point.status} />
                <span className="text-sm text-gray-600">
                  {getStatusLabel(point.status)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={24} />
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Avdelning:</span>
                <span className="ml-2 font-semibold">{details.departmentName ?? 'Ej tilldelad'}</span>
              </div>
              {details.name && (
                <div>
                  <span className="text-gray-600">Punkt-ID:</span>
                  <span className="ml-2">#{point.point_number}</span>
                </div>
              )}
              {details.departmentLocation && (
                <div>
                  <span className="text-gray-600">Plats:</span>
                  <span className="ml-2">{details.departmentLocation}</span>
                </div>
              )}
              {point.current_user && (
                <div>
                  <span className="text-gray-600">Aktuell användare:</span>
                  <span className="ml-2 font-semibold">
                    {point.current_user.full_name}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mb-4">
            <PointImageGallery pointId={point.id} canDelete={canDeleteImages} />
          </div>

          <input
            ref={cameraInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handlePhotoTaken}
          />

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Noteringar (valfritt, sparas med bilden)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={1000}
              placeholder="Lägg till noteringar..."
            />
          </div>

          <div className="space-y-2">
            {(allowedActions || ['LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER']).map((status) => getActionButton(status))}
            
            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold transition"
            >
              Avbryt
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
