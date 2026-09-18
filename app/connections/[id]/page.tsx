import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, bankConnections, syncRuns } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConnectionActions } from "@/components/connection-actions";
import { formatCents, formatRelativeTime } from "@/lib/format";

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

export default async function ConnectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const connection = db.select().from(bankConnections).where(eq(bankConnections.id, id)).get();
  if (!connection) notFound();

  const accountRows = db.select().from(accounts).where(eq(accounts.connectionId, id)).all();
  const runs = db
    .select()
    .from(syncRuns)
    .where(eq(syncRuns.connectionId, id))
    .orderBy(desc(syncRuns.startedAt))
    .limit(10)
    .all();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {connection.providerName ?? "Unknown institution"}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={statusVariant(connection.status)}>{connection.status}</Badge>
            synced {formatRelativeTime(connection.lastSyncedAt)}
          </p>
        </div>
        <ConnectionActions connectionId={connection.id} providerName={connection.providerName} />
      </div>

      {connection.lastError ? (
        <Card className="border-destructive">
          <CardContent className="py-4 text-sm text-destructive">{connection.lastError}</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountRows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <Link href={`/accounts/${a.id}`} className="hover:underline">
                      {a.displayName ?? a.productName ?? "Account"}
                    </Link>
                    <div className="text-xs text-muted-foreground">{a.maskedNumber}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.productCategory ?? a.accountType ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCents(a.balanceCurrent, a.currency ?? "AUD")}
                  </TableCell>
                </TableRow>
              ))}
              {accountRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No accounts synced yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent syncs</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">New transactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatRelativeTime(r.startedAt)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.trigger}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === "success"
                          ? "default"
                          : r.status === "error"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{r.transactionsAdded}</TableCell>
                </TableRow>
              ))}
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No syncs yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
