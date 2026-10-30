import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { Deck } from "../../shared/types";
import { fetchDeck } from "./client";

export function useDeckQuery(): UseQueryResult<Deck, Error> {
  // Not `queryFn: fetchDeck`: the query's context would arrive as the client.
  return useQuery({ queryKey: ["deck"], queryFn: () => fetchDeck() });
}
