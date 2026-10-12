import "server-only";
import { cache } from "react";
import { gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/server/db";
import type { CatalogEntryRow, GameOverrideRow } from "@/server/db/schema";
import { isProviderEnabled } from "@/modules/providers/registry";
import { CLOUD_GAMES } from "./cloud-games";
import { ORIGINALS } from "./originals";
import type { Device, GameRecord, Genre, InputMethod, LaunchType, Orientation, ProviderId, PublicGame, StreamOption } from "./types";

/* Catálogo = jogos de cloud gaming e próprios (código) + jogos cadastrados pelo admin (banco) + ajustes do admin. */

export function entryToRecord(row: CatalogEntryRow): GameRecord {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl: row.coverUrl ?? "/covers/placeholder.svg",
    genres: row.genres as Genre[],
    developer: row.developer ?? undefined,
    provider: row.provider as ProviderId,
    launch: { type: row.launchType as LaunchType, url: row.launchUrl || undefined },
    sdk: false,
    streams: row.streams.length ? (row.streams as StreamOption[]) : undefined,
    devices: row.devices as Device[],
    inputs: row.inputs as InputMethod[],
    orientation: row.orientation as Orientation,
    pricing: "free",
    access: "free",
    license: {
      status: row.provider === "gamedistribution" || row.provider === "cloud" ? "provider_terms" : "developer_permission",
      note: row.permissionNote,
    },
    ageRating: row.ageRating ? { value: row.ageRating, source: "official" } : undefined,
    availability: "available",
    requiresExternalAccount: undefined,
    limitations: row.limitations ? row.limitations.split("\n").filter(Boolean) : [],
    enabled: true,
    addedAt: row.createdAt.toISOString().slice(0, 10),
  };
}

export function applyOverride(g: GameRecord, o: GameOverrideRow | undefined): GameRecord {
  if (!o) return g;
  return {
    ...g,
    enabled: o.enabled ?? g.enabled,
    featured: o.featured ?? g.featured,
    access: o.access ?? g.access,
  };
}

async function popularityByGame(): Promise<Map<string, number>> {
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const rows = await db
    .select({ gameId: schema.playSessions.gameId, n: sql<number>`count(*)::int` })
    .from(schema.playSessions)
    .where(gte(schema.playSessions.startedAt, since))
    .groupBy(schema.playSessions.gameId);
  return new Map(rows.map((r) => [r.gameId, Number(r.n)]));
}

/** Catálogo completo, incluindo jogos desativados (para o painel administrativo). */
export const getFullCatalog = cache(async (): Promise<PublicGame[]> => {
  const db = await getDb();
  const [entries, overrides, popularity] = await Promise.all([
    db.select().from(schema.catalogEntries),
    db.select().from(schema.gameOverrides),
    popularityByGame(),
  ]);
  const ov = new Map(overrides.map((o) => [o.gameId, o]));
  const external = entries.map(entryToRecord).map((g) => (isProviderEnabled(g.provider) ? g : { ...g, enabled: false }));
  return [...CLOUD_GAMES, ...ORIGINALS, ...external].map((g) => ({ ...applyOverride(g, ov.get(g.id)), popularity: popularity.get(g.id) ?? 0 }));
});

/** Catálogo público: só jogos ativos. */
export async function getCatalog(): Promise<PublicGame[]> {
  return (await getFullCatalog()).filter((g) => g.enabled);
}

export async function getGame(id: string): Promise<PublicGame | null> {
  return (await getCatalog()).find((g) => g.id === id) ?? null;
}
