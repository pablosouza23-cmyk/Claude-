/* Aplica as migrações do banco (drizzle/). Uso: npm run db:migrate */
import { connect } from "../src/server/db/connect";

async function main() {
  const { kind, close } = await connect({ migrate: true });
  console.log(`Migrações aplicadas (${kind === "postgres" ? "PostgreSQL" : "PGlite embutido"}).`);
  await close();
}

main().catch((err) => {
  console.error("Falha ao migrar:", err);
  process.exit(1);
});
