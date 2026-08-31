import { useCallback, useRef, useState } from 'react';

export type ToastState = { message: string; variant: 'info' | 'error' } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string, variant: 'info' | 'error' = 'info', duration = variant === 'error' ? 4000 : 1800) => {
    setToast({ message, variant });
    if (toastTimer.current) {
      window.clearTimeout(toastTimer.current);
    }
    toastTimer.current = window.setTimeout(() => setToast(null), duration);
  }, []);

  return { toast, showToast };
}
