import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Deck } from "../../shared/types";
import { fetchDeck, OutOfDate } from "./client";
import { reloadIntoNewCode } from "./update";

// One fetch per launch, kept for the session: a new deck arrives with the next launch (the service worker fetches it
// network-first). After a failure only the error card's tap asks again. A deck this code can't read is no failure to
// retry: the new code that reads it shipped with it (`reloadIntoNewCode`).
export function useDeckQuery(): UseQueryResult<Deck, Error> {
  return useQuery({
    queryKey: ["deck"],
    // Not `queryFn: fetchDeck`, which would take the query's context for the client.
    queryFn: () =>
      fetchDeck().catch((error) => (error instanceof OutOfDate ? reloadIntoNewCode(error) : Promise.reject(error))),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: (failures, error) => !(error instanceof OutOfDate) && failures < 2,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
