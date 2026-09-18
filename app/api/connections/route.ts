import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, bankConnections } from "@/lib/db/schema";

export async function GET() {
  const connectionRows = db
    .select()
    .from(bankConnections)
    .orderBy(desc(bankConnections.createdAt))
    .all();

  const counts = db
    .select({ connectionId: accounts.connectionId, count: sql<number>`count(*)` })
    .from(accounts)
    .groupBy(accounts.connectionId)
    .all();
  const countByConnection = new Map(counts.map((c) => [c.connectionId, c.count]));

  const connections = connectionRows.map((c) => ({
    ...c,
    accountCount: countByConnection.get(c.id) ?? 0,
  }));

  return NextResponse.json({ connections });
}
