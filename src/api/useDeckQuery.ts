import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Deck } from "../../shared/types";
import { fetchDeck } from "./client";

// One fetch per launch, kept for the session: a new deck arrives with the next launch (the service worker fetches it
// network-first). After a failure only the error card's tap asks again.
export function useDeckQuery(): UseQueryResult<Deck, Error> {
  return useQuery({
    queryKey: ["deck"],
    queryFn: () => fetchDeck(), // not `queryFn: fetchDeck`, which would take the query's context for the client
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
