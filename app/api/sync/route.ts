import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema";
import { syncConnection } from "@/lib/sync/engine";

export async function POST() {
  const connections = db.select({ id: bankConnections.id }).from(bankConnections).all();
  const results = [];
  for (const { id } of connections) {
    results.push(await syncConnection(id, "manual-ui"));
  }
  return NextResponse.json({ results });
}
