"use client";

import { Button, ErrorState } from "@/components/ui";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorState
      lang="en"
      action={
        <Button type="button" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
