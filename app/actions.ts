"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db/client";
import { bankConnections } from "@/lib/db/schema";
import { syncConnection } from "@/lib/sync/engine";
import { unlinkConnection } from "@/lib/connections";

function refreshCommonPaths() {
  revalidatePath("/");
  revalidatePath("/connections");
  revalidatePath("/sync");
}

export async function syncAllAction() {
  const connections = db.select({ id: bankConnections.id }).from(bankConnections).all();
  for (const { id } of connections) {
    await syncConnection(id, "manual-ui");
  }
  refreshCommonPaths();
}

export async function syncConnectionAction(connectionId: string) {
  await syncConnection(connectionId, "manual-ui");
  refreshCommonPaths();
  revalidatePath(`/connections/${connectionId}`);
}

export async function unlinkConnectionAction(connectionId: string) {
  await unlinkConnection(connectionId);
  refreshCommonPaths();
}
