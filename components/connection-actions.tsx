"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { syncConnectionAction, unlinkConnectionAction } from "@/app/actions";

export function ConnectionActions({
  connectionId,
  providerName,
}: {
  connectionId: string;
  providerName: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSync() {
    startTransition(async () => {
      const label = providerName ?? "connection";
      try {
        await syncConnectionAction(connectionId);
        toast.success(`Synced ${label}`);
      } catch (err) {
        toast.error(`Sync failed for ${label}`, {
          description: err instanceof Error ? err.message : String(err),
        });
      }
      router.refresh();
    });
  }

  function onUnlink() {
    startTransition(async () => {
      const label = providerName ?? "connection";
      await unlinkConnectionAction(connectionId);
      toast.success(`Unlinked ${label}`);
      router.refresh();
    });
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={onSync} disabled={isPending}>
        Sync now
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          render={
            <Button variant="ghost" size="sm" disabled={isPending}>
              Unlink
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink {providerName ?? "this connection"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This withdraws consent at the bank and deletes all locally cached accounts and
              transactions for this connection. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={onUnlink}>Unlink</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
