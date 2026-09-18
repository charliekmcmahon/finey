import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, bankConnections, transactions } from "@/lib/db/schema";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SyncAllButton } from "@/components/sync-all-button";
import { formatCents, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const connectionRows = db.select().from(bankConnections).all();
  const accountRows = db.select().from(accounts).all();
  const recentTxns = db
    .select()
    .from(transactions)
    .orderBy(desc(transactions.executedAt))
    .limit(10)
    .all();

  if (connectionRows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome to Finey</h1>
        <p className="max-w-md text-muted-foreground">
          Link your first bank account to see balances and transactions here.
        </p>
        <Link href="/connections" className={buttonVariants({ variant: "default" })}>
          Go to connections
        </Link>
      </div>
    );
  }

  const byCurrency = new Map<string, number>();
  for (const a of accountRows) {
    if (a.balanceCurrent === null) continue;
    const currency = a.currency ?? "AUD";
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + a.balanceCurrent);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <SyncAllButton />
      </div>

      {byCurrency.size > 0 ? (
        <div className="flex gap-4">
          {[...byCurrency.entries()].map(([currency, cents]) => (
            <Card key={currency} className="flex-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-normal text-muted-foreground">
                  Total balance ({currency})
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {formatCents(cents, currency)}
              </CardContent>
            </Card>
          ))}
        </div>
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
                <TableHead>Bank</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accountRows.map((a) => {
                const connection = connectionRows.find((c) => c.id === a.connectionId);
                return (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/accounts/${a.id}`} className="hover:underline">
                        {a.displayName ?? a.productName ?? "Account"}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {connection?.providerName ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCents(a.balanceCurrent, a.currency ?? "AUD")}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTxns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(t.executedAt)}</TableCell>
                  <TableCell>{t.merchantName ?? t.description}</TableCell>
                  <TableCell className="text-right">
                    {formatCents(t.amount, t.currency ?? "AUD")}
                  </TableCell>
                </TableRow>
              ))}
              {recentTxns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No transactions yet.
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
