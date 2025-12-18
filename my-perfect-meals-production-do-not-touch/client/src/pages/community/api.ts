import { apiUrl } from '@/lib/resolveApiBase';

export type CreateCommunityPostInput = {
  text: string;
  imageUrl?: string;
  tags?: string[];
  isAnonymous?: boolean;
  isSuccessStory?: boolean;
};

export async function createCommunityPost(input: CreateCommunityPostInput) {
  const res = await fetch(apiUrl("/api/community/posts"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error("Failed to create community post");
  return res.json() as Promise<{ ok: true; post: any }>;
}