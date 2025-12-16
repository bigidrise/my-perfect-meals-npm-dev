import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiUrl } from '@/lib/resolveApiBase';

export type GalleryItem = {
  id: string;
  postId: string;
  title: string;
  imageUrl?: string;
  cookingInstructionsUrl?: string;
  tags: string[];
  createdAt: string;
};

async function fetchRecipeGallery(): Promise<GalleryItem[]> {
  try {
    const res = await fetch(apiUrl("/api/recipe-gallery"));
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch (error) {
    console.warn("Failed to fetch recipe gallery:", error);
    return [];
  }
}

export default function LatestRecipesStrip() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [, setLocation] = useLocation();

  useEffect(() => {
    fetchRecipeGallery().then(setItems);
  }, []);

  if (!items.length) return null;

  const handleRecipeClick = (item: GalleryItem) => {
    if (item.cookingInstructionsUrl) {
      setLocation(item.cookingInstructionsUrl);
    } else {
      setLocation(`/community/post/${item.postId}`);
    }
  };

  return (
    <div className="mb-4 bg-white/10 border border-white/15 backdrop-blur-md rounded-2xl p-3 text-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Latest Recipes</h3>
        <button
          onClick={() => setLocation("/community/recipes")}
          className="text-white/80 hover:text-white text-sm"
          data-testid="button-see-all-recipes"
        >
          See all →
        </button>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {items.slice(0, 6).map((item) => (
          <button
            key={item.id}
            onClick={() => handleRecipeClick(item)}
            className="group relative rounded-lg overflow-hidden border border-white/10 hover:border-white/20 transition-colors"
            title={item.title}
            data-testid={`recipe-thumbnail-${item.id}`}
          >
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.title} 
                className="w-full h-20 object-cover"
              />
            ) : (
              <div className="w-full h-20 bg-black/30 flex items-center justify-center text-xs">
                No image
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 text-[10px] bg-black/50 px-1 py-0.5 truncate">
              {item.title}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}