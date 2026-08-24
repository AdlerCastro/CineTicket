import QrScanner from 'qr-scanner';

// qr-scanner (nimiq, D46) v1.4+ resolve o Web Worker sozinho via
// `new URL(..., import.meta.url)`, compatível com o bundler do Next.js —
// setar QrScanner.WORKER_PATH manualmente (necessário em versões antigas da
// lib) hoje só emite um aviso deprecated no console, sem efeito real.
export { QrScanner };
