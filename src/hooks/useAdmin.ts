"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdmin } from "../lib/contractClient";

export function useAdmin() {
  const { data: admin = null, isLoading } = useQuery<string, Error>({
    queryKey: ["admin"],
    queryFn: getAdmin,
    staleTime: Infinity,
    retry: 1,
  });

  return { admin, isLoading };
}
