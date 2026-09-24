import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { getPointImages, MAX_IMAGES_PER_POINT, PointImage } from '../../lib/pointImages';

interface PointImageGalleryProps {
  pointId: string;
  /** Larger thumbnails and notes, used for the read-only Monitor view. */
  large?: boolean;
}

/** The latest photos (and their notes) taken for a point. */
export default function PointImageGallery({ pointId, large = false }: PointImageGalleryProps) {
  const [images, setImages] = useState<PointImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getPointImages(pointId)
      .then((result) => !cancelled && setImages(result))
      .catch((error) => console.error('Error loading point images:', error))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [pointId]);

  const grid = large ? 'grid grid-cols-1 sm:grid-cols-3 gap-4' : 'grid grid-cols-3 gap-2';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Senaste bilder</span>
        <span className="text-xs text-gray-500">
          {images.length}/{MAX_IMAGES_PER_POINT}
        </span>
      </div>

      {loading ? (
        <div className={grid}>
          {Array.from({ length: MAX_IMAGES_PER_POINT }).map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : images.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
          <ImageOff size={18} />
          Inga bilder ännu. En bild tas när punkten markeras som upptagen.
        </div>
      ) : (
        <div className={grid}>
          {images.map((image) => (
            <div key={image.id} className="flex flex-col gap-1">
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block aspect-square overflow-hidden rounded-lg bg-gray-100"
              >
                <img
                  src={image.url}
                  alt="Bild av punkten"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                <span
                  className={`absolute inset-x-0 bottom-0 bg-black/55 text-white ${
                    large ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'
                  }`}
                >
                  {format(new Date(image.created_at), 'd MMM HH:mm', { locale: sv })}
                </span>
              </a>
              {image.note && (
                <p
                  className={`leading-snug text-gray-600 break-words ${
                    large ? 'text-sm' : 'text-[11px] line-clamp-3'
                  }`}
                  title={image.note}
                >
                  {image.note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
