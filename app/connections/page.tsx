import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, bankConnections } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionActions } from "@/components/connection-actions";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "error":
      return "destructive";
    case "revoked":
      return "secondary";
    default:
      return "outline";
  }
}

export default function ConnectionsPage() {
  const connectionRows = db
    .select()
    .from(bankConnections)
    .orderBy(desc(bankConnections.createdAt))
    .all();

  // A raw correlated subquery here would need explicit table-qualified column names
  // (accounts and bank_connections both have an "id" column) — a separate grouped
  // count avoids that footgun entirely.
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
        <form action="/api/auth/start" method="POST">
          <Button type="submit">Add bank</Button>
        </form>
      </div>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No banks linked yet. Click &quot;Add bank&quot; to connect your first account via
            openfeed.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {connections.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>
                    <Link href={`/connections/${c.id}`} className="hover:underline">
                      {c.providerName ?? "Unknown institution"}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {c.accountCount} account{c.accountCount === 1 ? "" : "s"} · synced{" "}
                    {formatRelativeTime(c.lastSyncedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                  <ConnectionActions connectionId={c.id} providerName={c.providerName} />
                </div>
              </CardHeader>
              {c.status === "error" && c.lastError ? (
                <CardContent className="pt-0 text-sm text-destructive">{c.lastError}</CardContent>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
