import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 'standalone' reduz drasticamente o tamanho da imagem Docker: gera
  // server.js + só o node_modules tracejado (necessário em runtime), em
  // vez de copiar node_modules/.next inteiros para a imagem final.
  output: 'standalone',
  // Monorepo pnpm: sem isso, o file tracing usaria frontend/ como raiz e
  // não enxergaria packages/shared (fora de frontend/), gerando standalone
  // incompleto. Raiz do tracing = raiz do monorepo.
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '..'),
  },
};

export default nextConfig;
