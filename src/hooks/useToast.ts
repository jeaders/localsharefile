"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 3500);
  }, []);

  const dismissToast = useCallback(() => {
    window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  useEffect(() => {
    return () => window.clearTimeout(timer.current);
  }, []);

  return { toast, showToast, dismissToast };
}
