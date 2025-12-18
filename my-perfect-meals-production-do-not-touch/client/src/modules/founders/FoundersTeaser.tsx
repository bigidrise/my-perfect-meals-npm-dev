import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function FoundersTeaser() {
  const [, setLocation] = useLocation();

  return (
    <div className="bg-gradient-to-r from-black via-purple-600 to-black rounded-xl shadow-2xl shadow-black/80 p-6 mb-8">
      <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-white/20 bg-black/40 p-3">
            <Users className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-white">Founders</h3>
              <Badge className="bg-white/10 border border-white/20 text-white text-xs">Alpha · Beta</Badge>
            </div>
            <p className="text-sm text-white/90">
              Meet the early believers who helped build My Perfect Meals. Real faces. Real stories. Real results.
            </p>
          </div>
        </div>

        <Button
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white hover:shadow-lg transition-all duration-200 whitespace-nowrap"
          onClick={() => setLocation("/founders")}
          data-testid="button-view-founders"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          View Founders
        </Button>
      </div>
    </div>
  );
}
