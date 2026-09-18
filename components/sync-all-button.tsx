"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncAllAction } from "@/app/actions";

export function SyncAllButton() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    startTransition(async () => {
      await syncAllAction();
      toast.success("Synced all connections");
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={isPending}>
      {isPending ? "Syncing…" : "Sync all now"}
    </Button>
  );
}
