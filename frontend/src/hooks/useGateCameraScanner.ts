'use client';

import { useEffect, useRef, useState } from 'react';
import { QrScanner } from '@/lib/qr-scanner-client';

export type GateCameraStatus =
  'idle' | 'starting' | 'active' | 'error' | 'unsupported';

interface UseGateCameraScannerOptions {
  enabled: boolean;
  onDecode: (token: string) => void;
}

// Encapsula o ciclo de vida do QrScanner (nimiq/qr-scanner, D46): só liga a
// câmera quando `enabled` (a tela de portaria exige sessão selecionada
// primeiro — ver .context/project-state.md) e decodifica continuamente,
// repassando só o texto lido (o JWT) via onDecode — quem chama decide o que
// fazer com scans repetidos (ver GateScanner).
export function useGateCameraScanner({
  enabled,
  onDecode,
}: UseGateCameraScannerOptions) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [status, setStatus] = useState<GateCameraStatus>('idle');

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    const videoEl = videoRef.current;
    if (!videoEl) return;

    let cancelled = false;
    let scanner: QrScanner | null = null;

    setStatus('starting');

    QrScanner.hasCamera()
      .then((supported) => {
        if (cancelled) return;
        if (!supported) {
          setStatus('unsupported');
          return;
        }

        scanner = new QrScanner(videoEl, (result) => onDecode(result.data), {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment',
        });

        scanner
          .start()
          .then(() => {
            if (!cancelled) setStatus('active');
          })
          .catch(() => {
            if (!cancelled) setStatus('error');
          });
      })
      .catch(() => {
        if (!cancelled) setStatus('unsupported');
      });

    return () => {
      cancelled = true;
      scanner?.stop();
      scanner?.destroy();
    };
  }, [enabled, onDecode]);

  return { videoRef, status };
}
