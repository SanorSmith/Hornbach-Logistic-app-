import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import {
  getInstallPrompt,
  isIosSafari,
  isStandalone,
  onInstallPromptChange,
  promptInstall,
} from '../../lib/pwa';

const DISMISS_KEY = 'gm-install-dismissed-at';
const DISMISS_DAYS = 14;

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return at > 0 && Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Bottom sheet offering to install the app, shown on first load on phones,
 * tablets and Zebra devices. Hidden when already installed, or for 14 days
 * after "Inte nu".
 */
export default function InstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(() => getInstallPrompt() !== null);
  const [hidden, setHidden] = useState(() => isStandalone() || recentlyDismissed());
  const ios = isIosSafari();

  useEffect(() => onInstallPromptChange(() => setCanPrompt(getInstallPrompt() !== null)), []);

  if (hidden || (!canPrompt && !ios)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // storage unavailable (private mode) - just hide for this visit
    }
    setHidden(true);
  };

  const install = async () => {
    const installed = await promptInstall();
    if (installed) setHidden(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4 pointer-events-none" role="dialog" aria-label="Installera appen">
      <div className="pointer-events-auto mx-auto max-w-md rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 p-4">
        <div className="flex items-start gap-3">
          <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-xl" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900">Installera GM Logistik</h2>
            <p className="text-sm text-gray-600 mt-0.5">
              Lägg till appen på hemskärmen – den startar snabbt och öppnas i helskärm.
            </p>
          </div>
          <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Stäng">
            <X size={20} />
          </button>
        </div>

        {canPrompt ? (
          <div className="mt-4 flex gap-2">
            <button
              onClick={dismiss}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
            >
              Inte nu
            </button>
            <button
              onClick={install}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
            >
              <Download size={18} />
              Installera
            </button>
          </div>
        ) : (
          <ol className="mt-4 space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">1</span>
              Tryck på <Share size={16} className="text-indigo-600" /> <strong>Dela</strong> i Safari
            </li>
            <li className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold">2</span>
              Välj <SquarePlus size={16} className="text-indigo-600" /> <strong>Lägg till på hemskärmen</strong>
            </li>
          </ol>
        )}
      </div>
    </div>
  );
}
