import { useEffect } from 'react';
import { useAppStore } from '../data/store';

export function useTheme() {
  const temaOscuro = useAppStore((s) => s.temaOscuro);
  const toggleTema = useAppStore((s) => s.toggleTema);

  useEffect(() => {
    const root = document.documentElement;
    if (temaOscuro) {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [temaOscuro]);

  return { temaOscuro, toggleTema };
}
