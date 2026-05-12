"use client";
import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // 5 min default — most reference data (employees, contracts,
            // crew sets, vehicles) doesn't change between sub-minute
            // sidebar nav clicks. Component-level useQuery calls override
            // when they need fresher data (e.g. tracker chat = 30s,
            // pending decisions = 60s). The previous 15s default caused
            // a refetch storm on every nav between sidebar items because
            // remounts happened inside the cache window.
            staleTime: 300_000,
            gcTime: 600_000, // 10min — keep cached data before GC
            refetchOnMount: true,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
