import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';

interface QRGeneratorProps {
  value: string;
  pointNumber: number;
  assignments?: Record<string, string>;
  pointId?: string;
}

export default function QRGenerator({ value, pointNumber, assignments, pointId }: QRGeneratorProps) {
  const downloadQR = () => {
    const svg = document.getElementById(`qr-${pointNumber}`) as unknown as SVGElement;
    if (svg) {
      const svgData = new XMLSerializer().serializeToString(svg);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `punkt-${pointNumber}-qr.png`;
        link.href = url;
        link.click();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-white">
      <QRCodeSVG
        id={`qr-${pointNumber}`}
        value={value}
        size={200}
        level="H"
        includeMargin
      />
      <div className="text-center">
        <p className="font-bold text-2xl text-gray-800">
          {assignments && pointId && assignments[pointId] ? assignments[pointId] : `Punkt ${pointNumber}`}
        </p>
        <p className="text-sm text-gray-500">{value}</p>
      </div>
      <button
        onClick={downloadQR}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        <Download size={18} />
        Ladda ner
      </button>
    </div>
  );
}
