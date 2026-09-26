import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RedPoint, PointStatus } from '../../types';
import { X, Package, Trash2, CheckCircle, Camera, Loader2, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { deletePointImage, pruneOldImages, uploadPointImage } from '../../lib/pointImages';
import { getLimitedChangeWait, isLimitedChange, RATE_LIMIT_MESSAGE } from '../../lib/rateLimit';
import PointImageGallery from './PointImageGallery';
import { usePointDetails } from '../../hooks/usePointDetails';
import { getStatusLabel } from '../../utils/statusColors';
import StatusCircle from './StatusCircle';

interface PointActionModalProps {
  point: RedPoint;
  onClose: () => void;
  /** Resolves true when the status was saved. */
  onUpdateStatus: (status: PointStatus, notes?: string) => Promise<boolean | void>;
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const details = usePointDetails(point);

  // Anti-cheating limit (see lib/rateLimit.ts): count down while blocked.
  const [waitUntil, setWaitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const remaining = waitUntil ? Math.max(0, Math.ceil((waitUntil - now) / 1000)) : 0;

  const startWait = (seconds: number) => {
    setNow(Date.now());
    setWaitUntil(Date.now() + seconds * 1000);
  };

  useEffect(() => {
    getLimitedChangeWait().then((seconds) => {
      if (seconds > 0) startWait(seconds);
    });
  }, [point.id]);

  useEffect(() => {
    if (!waitUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [waitUntil]);

  const isRateLimited = (status: PointStatus) => remaining > 0 && isLimitedChange(point.status, status);

  const showRateLimit = (seconds: number) =>
    toast.error(`${RATE_LIMIT_MESSAGE} Försök igen om ${seconds} s.`, { duration: 6000 });

  // After a refused change: keep the dialog open, explain why and show the
  // countdown if it was the rate limit.
  const handleFailedChange = async (status: PointStatus) => {
    const wait = isLimitedChange(point.status, status) ? await getLimitedChangeWait() : 0;
    if (wait > 0) {
      startWait(wait);
      setErrorMessage(`${RATE_LIMIT_MESSAGE} Knappen låses upp när tiden har gått.`);
    } else {
      setErrorMessage('Statusen kunde inte sparas. Kontrollera anslutningen och försök igen.');
    }
  };

  const handleUpdateStatus = async (newStatus: PointStatus) => {
    setErrorMessage(null);
    if (isRateLimited(newStatus)) {
      showRateLimit(remaining);
      return;
    }
    // Marking as UPPTAGEN requires a photo: open the camera first.
    if (newStatus === 'UPPTAGEN') {
      cameraInput.current?.click();
      return;
    }
    setIsUpdating(true);
    const saved = await onUpdateStatus(newStatus, notes || undefined);
    setIsUpdating(false);
    if (saved === false) {
      await handleFailedChange(newStatus);
      return;
    }
    onClose();
  };

  const handlePhotoTaken = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow taking the same photo again
    if (!file) return; // camera cancelled - status is not changed

    setErrorMessage(null);
    setIsUpdating(true);

    // Check the limit before uploading, so no photo is saved for a change the
    // database would refuse.
    const wait = isLimitedChange(point.status, 'UPPTAGEN') ? await getLimitedChangeWait() : 0;
    if (wait > 0) {
      startWait(wait);
      setErrorMessage(`${RATE_LIMIT_MESSAGE} Knappen låses upp när tiden har gått.`);
      setIsUpdating(false);
      return;
    }

    setIsUploading(true);
    let imageId: string;
    try {
      imageId = await uploadPointImage(point.id, file, notes);
    } catch (error) {
      console.error('Error uploading point image:', error);
      setErrorMessage('Kunde inte spara bilden. Status ändrades inte.');
      setIsUpdating(false);
      setIsUploading(false);
      return;
    }
    setIsUploading(false);

    const saved = await onUpdateStatus('UPPTAGEN', notes || undefined);
    if (saved === false) {
      // The status change was refused: remove the photo again so it isn't
      // left behind without the change it belongs to.
      await deletePointImage(imageId).catch((error) => console.error('Error removing photo:', error));
      setIsUpdating(false);
      await handleFailedChange('UPPTAGEN');
      return;
    }

    await pruneOldImages(point.id).catch((error) => console.error('Error pruning old photos:', error));
    setNotes(''); // the note is stored with the photo; start empty next time
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
    const limited = isRateLimited(status);

    return (
      <button
        key={status}
        onClick={() => handleUpdateStatus(status)}
        disabled={isUpdating || isDisabled || limited}
        title={isDisabled ? 'Inte tillgänglig på den här sidan' : limited ? RATE_LIMIT_MESSAGE : undefined}
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
        ) : limited ? (
          <>
            <Clock size={20} />
            {getStatusLabel(status)} · vänta {remaining} s
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
              aria-label="Stäng"
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

          {errorMessage && (
            <div role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

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
