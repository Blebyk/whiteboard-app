'use client';

import { useState, useEffect } from 'react';

/**
 * Реактивно сообщает, узкий ли сейчас вьюпорт (телефон / небольшой планшет).
 * На сервере и при первом рендере возвращает false, затем уточняет после
 * монтирования через matchMedia — поэтому интерфейс по умолчанию «десктопный»,
 * а на телефоне переключается на мобильную раскладку сразу после гидрации.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}
