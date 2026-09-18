import { notFound } from "next/navigation";
import { and, desc, eq, gte, like, lte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { accounts, transactions } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCents, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; from?: string; to?: string }>;
}) {
  // openfeed account ids are opaque tokens that can contain +/=, which Next does not
  // decode out of dynamic route params on its own — decode explicitly before using it
  // as a lookup key, or a literal "%3D%3D" ends up in the WHERE clause instead of "==".
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const { q, from, to } = await searchParams;
  const account = db.select().from(accounts).where(eq(accounts.id, id)).get();
  if (!account) notFound();

  const conditions = [eq(transactions.accountId, id)];
  if (q) conditions.push(like(transactions.description, `%${q}%`));
  if (from) conditions.push(gte(transactions.executedAt, new Date(from)));
  if (to) conditions.push(lte(transactions.executedAt, new Date(to)));

  const txns = db
    .select()
    .from(transactions)
    .where(and(...conditions))
    .orderBy(desc(transactions.executedAt))
    .limit(200)
    .all();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {account.displayName ?? account.productName ?? "Account"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {account.maskedNumber} · Balance {formatCents(account.balanceCurrent, account.currency ?? "AUD")}
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2" method="GET">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="q">
            Search
          </label>
          <Input id="q" name="q" placeholder="Description" defaultValue={q} className="w-48" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="from">
            From
          </label>
          <Input id="from" name="from" type="date" defaultValue={from} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground" htmlFor="to">
            To
          </label>
          <Input id="to" name="to" type="date" defaultValue={to} />
        </div>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txns.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(t.executedAt)}</TableCell>
                  <TableCell>
                    {t.merchantName ?? t.description}
                    {t.merchantName && t.description && t.description !== t.merchantName ? (
                      <div className="text-xs text-muted-foreground">{t.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.status === "PENDING" ? "outline" : "secondary"}>
                      {t.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCents(t.amount, t.currency ?? "AUD")}
                  </TableCell>
                </TableRow>
              ))}
              {txns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No transactions.
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
