const { execSync } = require("child_process");
const path = require("path");

// Roda o src/prisma/seed.ts real (não uma cópia/mock) contra o banco de
// teste antes da suíte e2e, só para materializar os 4 usuários fixos
// (organizador, 2 clientes, portaria) usados pelos specs. O seed também cria
// uma sessão/assentos fixos como efeito colateral — os specs desta suíte
// deliberadamente não referenciam esses IDs, criando sua própria
// Session/Seat descartável via Prisma (ver support/fixtures.ts).
module.exports = async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL não definido. Exporte as variáveis do banco de teste " +
        "(porta 5435, ver docker-compose.test.yml) antes de rodar test:e2e.",
    );
  }

  const backendRoot = path.resolve(__dirname, "..", "..", "..");

  execSync("pnpm exec ts-node src/prisma/seed.ts", {
    cwd: backendRoot,
    stdio: "inherit",
    env: process.env,
  });
};
