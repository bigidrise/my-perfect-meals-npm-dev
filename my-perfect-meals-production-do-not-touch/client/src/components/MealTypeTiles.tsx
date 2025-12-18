import { Link } from "wouter";

export function MealTypeTiles() {
  const Tile = ({ href, title, blurb }: { href: string; title: string; blurb: string }) => (
    <Link href={href} className="block rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition">
      <h3 className="text-white font-semibold">{title}</h3>
      <p className="text-white/70 text-sm mt-1">{blurb}</p>
    </Link>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile href="/meals/breakfast" title="Breakfast" blurb="15 meals • editable templates" />
      <Tile href="/meals/lunch"     title="Lunch"     blurb="15 meals • editable templates" />
      <Tile href="/meals/dinner"    title="Dinner"    blurb="15 meals • editable templates" />
      <Tile href="/meals/snacks"    title="Snacks"    blurb="15 snacks • editable templates" />
    </div>
  );
}