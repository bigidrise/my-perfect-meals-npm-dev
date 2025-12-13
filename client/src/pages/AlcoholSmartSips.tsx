import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Wine, Info } from "lucide-react";

type Drink = { name: string; serve: string; kcal: string; carbs: string; how: string };

const DRINKS: Drink[] = [
  { name: "Vodka Soda + Lime", serve: "1.5 oz + soda", kcal: "~100", carbs: "~0g", how: "Ask for extra lime; no juice." },
  { name: "Tequila Soda + Lime (Blanco)", serve: "1.5 oz + soda", kcal: "~100", carbs: "~0g", how: "Blanco tequila; skip agave." },
  { name: "Gin & Soda + Cucumber", serve: "1.5 oz + soda", kcal: "~100", carbs: "~0g", how: "Skip tonic; add cucumber." },
  { name: "Whiskey Neat/Rocks", serve: "1.5 oz", kcal: "~105", carbs: "~0g", how: "Optional splash water." },
  { name: "Skinny Margarita", serve: "1.5 oz tequila + lime + soda", kcal: "~130–150", carbs: "~4–6g", how: "No sour mix; add bitters." },
  { name: "Paloma Lite", serve: "tequila + grapefruit wedge + soda", kcal: "~110–130", carbs: "~2–4g", how: "No grapefruit soda." },
  { name: "Rum & Diet Cola", serve: "1.5 oz", kcal: "~100", carbs: "~0g", how: "Add lime (diet Cuba Libre)." },
  { name: "Vodka + Unsweet Iced Tea", serve: "1.5 oz", kcal: "~100–120", carbs: "~0–2g", how: "Unsweet tea; squeeze lemon." },
  { name: "Dry Martini", serve: "2.5 oz spirit + dry vermouth", kcal: "~180–200", carbs: "~1–2g", how: "Small, slow sip." },
  { name: "Wine Spritzer (Dry White)", serve: "5 oz wine + soda", kcal: "~80–90", carbs: "~2–3g", how: "Tall glass; more soda." },
  { name: "Dry White Wine", serve: "5 oz", kcal: "~115–125", carbs: "~2–4g", how: "Ask for ‘dry’ varietals." },
  { name: "Dry Red Wine", serve: "5 oz", kcal: "~120–130", carbs: "~3–4g", how: "Pick drier styles (Pinot, Cab)." },
  { name: "Brut Bubbles", serve: "5 oz prosecco/champagne", kcal: "~90–110", carbs: "~2–4g", how: "Say ‘brut’ for drier." },
  { name: "Light Beer", serve: "12 oz", kcal: "~90–110", carbs: "~3–7g", how: "Ask for light/session." },
  { name: "Michelada-Lite", serve: "light beer + lime + hot sauce", kcal: "~110–130", carbs: "~4–6g", how: "No premade mix." },
  { name: "Hard Seltzer (Zero Sugar)", serve: "12 oz", kcal: "~90–100", carbs: "~2g", how: "Confirm zero sugar." },
  { name: "Tequila Rocks + Orange Peel", serve: "1.5 oz", kcal: "~100–110", carbs: "~0g", how: "Aromatic without syrup." },
  { name: "Whiskey Highball", serve: "1.5 oz whiskey + soda", kcal: "~105", carbs: "~0g", how: "Tall glass; slow sip." },
  { name: "Aperol Spritz-Lite", serve: "2 oz Aperol + prosecco + soda", kcal: "~140–160", carbs: "~10–12g", how: "Extra soda; light Aperol." },
  { name: "NA Saver: Soda + Bitters + Lime", serve: "12–16 oz", kcal: "0–10", carbs: "~0g", how: "No syrup; looks like a cocktail." },
];

export default function AlcoholSmartSips() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black/60 via-orange-600 to-black/80 text-white">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setLocation("/alcohol-hub")}
        className="fixed top-4 left-4 z-50 text-white hover:bg-white/10 bg-black/60 border border-white/40"
        aria-label="Back to Alcohol Hub"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <div className="bg-zinc-900/80 border border-white/30 rounded-2xl">
          <div className="p-6 flex items-center gap-3">
            <Wine className="h-6 w-6 text-rose-300" />
            <h1 className="text-2xl font-bold">Smart Sips: Diet-Friendly Drinks & Wines</h1>
          </div>
          <div className="px-6 pb-4 text-sm">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4" />
              <span>Default rule: Spirits + soda + citrus. Ask for “dry / brut / light” and “no sour mix / no syrup.”</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-5">
          {DRINKS.map((d, i) => (
            <Card key={i} className="bg-black/70 border border-white/30 text-white rounded-2xl">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{d.name}</h3>
                  <div className="text-xs">{d.kcal} • {d.carbs}</div>
                </div>
                <div className="text-xs mt-1">Serve: {d.serve}</div>
                <div className="text-sm mt-2">{d.how}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-6 flex justify-center">
          <Button
            onClick={() => setLocation("/plan-builder-hub")}
            className="bg-indigo-600 hover:bg-indigo-500 px-6 text-white rounded-xl"
          >
            Back to Weekly Meal Board
          </Button>
        </div>
      </div>
    </div>
  );
}
