import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema";
import { unlinkConnection } from "@/lib/connections";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const connection = db.select().from(bankConnections).where(eq(bankConnections.id, id)).get();
  if (!connection) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await unlinkConnection(id);
  return NextResponse.json({ ok: true });
}
