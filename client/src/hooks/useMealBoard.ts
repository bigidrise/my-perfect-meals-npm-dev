import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "@/lib/api";

export type Board = {
  id: string;
  userId: string;
  program: string;
  startDate: string;
  days: number;
  title: string;
};

export type BoardItem = {
  id: string;
  boardId: string;
  dayIndex: number;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  mealId: string;
  title: string;
  servings: number;
  macros: { kcal: number; protein: number; carbs: number; fat: number };
  ingredients: Array<{ name: string; qty: string }>;
};

export function useCurrentBoard(
  userId: string,
  program: "glp1" | "smart" | "medical" | "diabetic",
  startISO?: string,
  days = 7
) {
  const qs = new URLSearchParams({ days: String(days) });
  if (startISO) qs.set("start", startISO);
  const url = `/api/users/${userId}/boards/${program}/current?${qs.toString()}`;
  
  return useQuery({
    queryKey: [url],
    queryFn: () => get<{ board: Board; items: BoardItem[] }>(url),
    staleTime: 60_000,
    retry: 2,
  });
}

export function useAddBoardItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<BoardItem, "id">) => 
      post(`/api/boards/${input.boardId}/items`, input),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useDeleteBoardItem(boardId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => 
      del(`/api/boards/${boardId}/items/${itemId}`),
    onSuccess: () => qc.invalidateQueries(),
  });
}

export function useCommitBoard(boardId: string) {
  return useMutation({
    mutationFn: (p: { scope: "day" | "week"; dayIndex?: number }) =>
      post(`/api/boards/${boardId}/commit`, p)
  });
}
