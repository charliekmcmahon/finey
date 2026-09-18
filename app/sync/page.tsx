import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { bankConnections, syncRuns } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SyncAllButton } from "@/components/sync-all-button";
import { formatRelativeTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function SyncHistoryPage() {
  const runs = db
    .select({
      id: syncRuns.id,
      providerName: bankConnections.providerName,
      trigger: syncRuns.trigger,
      status: syncRuns.status,
      startedAt: syncRuns.startedAt,
      accountsSynced: syncRuns.accountsSynced,
      transactionsAdded: syncRuns.transactionsAdded,
      errorMessage: syncRuns.errorMessage,
    })
    .from(syncRuns)
    .leftJoin(bankConnections, eq(syncRuns.connectionId, bankConnections.id))
    .orderBy(desc(syncRuns.startedAt))
    .limit(100)
    .all();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Sync history</h1>
        <SyncAllButton />
      </div>
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">New transactions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{formatRelativeTime(r.startedAt)}</TableCell>
                  <TableCell>{r.providerName ?? "—"}</TableCell>
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
                    {r.errorMessage ? (
                      <div className="mt-1 max-w-xs truncate text-xs text-destructive">
                        {r.errorMessage}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">{r.transactionsAdded}</TableCell>
                </TableRow>
              ))}
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
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
