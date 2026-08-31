import { useEffect, useState } from 'react';
import type { ToastState } from '../hooks/useToast';

export function Toast({ toast }: { toast: ToastState }) {
  const [text, setText] = useState(toast?.message ?? '');
  const [variant, setVariant] = useState<'info' | 'error'>(toast?.variant ?? 'info');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (toast?.message) {
      setText(toast.message);
      setVariant(toast.variant);
      setOpen(false);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setOpen(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }
    setOpen(false);
    const hide = window.setTimeout(() => setText(''), 320);
    return () => window.clearTimeout(hide);
  }, [toast]);

  if (!text) {
    return null;
  }

  const isError = variant === 'error';

  return (
    <div className="fixed bottom-4 left-4 z-50 pointer-events-none max-w-[min(32rem,calc(100vw-2rem))]">
      <div
        className={`text-xs shadow-sm rounded-md px-3 py-2 transition-opacity duration-300 ease-out border ${
          isError ? 'text-red-800 bg-red-50/95 border-red-200' : 'text-stone-600 bg-white/95 border-stone-200'
        } ${open ? 'opacity-100' : 'opacity-0'}`}
        title={text}
      >
        <div className="break-all leading-snug">{text}</div>
      </div>
    </div>
  );
}
