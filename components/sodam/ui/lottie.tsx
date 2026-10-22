'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Lottie via official player (LottieFiles) — distinctive motion for hero/empty.
 * Local JSON avoids CDN flakes; player script from unpkg.
 * @see https://lottiefiles.com/
 */
const LOTTIE_SRC = '/products/lottie/sodam-hero.json';
const PLAYER_SRC = 'https://unpkg.com/@lottiefiles/lottie-player@2.0.12/dist/lottie-player.js';

type Props = {
  className?: string;
  fallbackSrc?: string;
};

export function SodamLottie({ className, fallbackSrc = '/products/sodam-hero.svg' }: Props) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const ensure = async () => {
      if (customElements.get('lottie-player')) {
        if (!cancelled) setReady(true);
        return;
      }
      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${PLAYER_SRC}"]`);
        if (existing) {
          if (customElements.get('lottie-player')) {
            resolve();
            return;
          }
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject());
          return;
        }
        const script = document.createElement('script');
        script.src = PLAYER_SRC;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
      }).catch(() => {
        if (!cancelled) setFailed(true);
      });
      if (!cancelled && customElements.get('lottie-player')) setReady(true);
      else if (!cancelled) setFailed(true);
    };
    void ensure();
    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={fallbackSrc} alt="" className={cn('h-auto w-full object-contain', className)} />
    );
  }

  if (!ready) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={fallbackSrc}
        alt=""
        className={cn('h-auto w-full object-contain opacity-90', className)}
      />
    );
  }

  return (
    <div className={cn('overflow-hidden', className)}>
      {/* @ts-expect-error custom element from LottieFiles */}
      <lottie-player
        autoplay
        loop
        mode="normal"
        src={LOTTIE_SRC}
        background="transparent"
        style={{ width: '100%', height: '100%', minHeight: 160, display: 'block' }}
      />
    </div>
  );
}
