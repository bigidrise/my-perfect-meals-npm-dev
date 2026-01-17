import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Info, BookOpen, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MedicalSourcesInfoProps {
  trigger?: React.ReactNode;
  asIconButton?: boolean;
  asPillButton?: boolean;
}

export function MedicalSourcesInfo({ trigger, asIconButton = false, asPillButton = false }: MedicalSourcesInfoProps) {
  const [open, setOpen] = useState(false);

  const pillTrigger = (
    <button
      className="inline-flex items-center justify-center px-3 py-[2px] min-w-[44px] rounded-full text-[9px] font-semibold uppercase tracking-wide transition-all duration-150 ease-out whitespace-nowrap bg-purple-500/20 text-purple-200 hover:bg-purple-500/30 border border-purple-400/40"
      aria-label="View sources and methodology"
    >
      Info
    </button>
  );

  const iconTrigger = (
    <button
      className="p-1.5 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors touch-manipulation select-none active:bg-white/30"
      aria-label="View sources and methodology"
    >
      <Info className="w-4 h-4 text-white/70" />
    </button>
  );

  const fullTrigger = (
    <Button variant="ghost" className="w-full justify-start text-white hover:text-white hover:bg-purple-900/20">
      <BookOpen className="mr-2 h-5 w-5" />
      Medical Information & Sources
    </Button>
  );

  const defaultTrigger = asPillButton ? pillTrigger : asIconButton ? iconTrigger : fullTrigger;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent 
        side="bottom" 
        className="bg-black/95 border-t border-white/20 text-white max-h-[85vh] overflow-y-auto rounded-t-3xl"
      >
        <SheetHeader className="text-left pb-4 border-b border-white/10">
          <SheetTitle className="text-white text-xl flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-lime-400" />
            Sources & Medical Information
          </SheetTitle>
        </SheetHeader>

        <div className="py-6 space-y-6">
          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              How nutritional values are calculated
            </h3>
            <p className="text-white/80 text-sm leading-relaxed">
              My Perfect Meals uses established public reference data to estimate calories, 
              macronutrients, and nutrition targets. Values shown in the app are estimates 
              and may vary based on ingredients, preparation, and individual needs.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Primary sources include
            </h3>
            <ul className="space-y-3">
              <SourceItem
                title="USDA FoodData Central"
                description="Comprehensive database for food nutrient data"
                url="https://fdc.nal.usda.gov/"
              />
              <SourceItem
                title="NIH Dietary Reference Intakes (DRIs)"
                description="Evidence-based nutrient intake recommendations"
                url="https://ods.od.nih.gov/HealthInformation/Dietary_Reference_Intakes.aspx"
              />
              <SourceItem
                title="World Health Organization (WHO)"
                description="International nutrition guidelines and standards"
                url="https://www.who.int/health-topics/nutrition"
              />
              <SourceItem
                title="American Diabetes Association (ADA)"
                description="Nutrition guidance for diabetic-friendly options"
                url="https://diabetes.org/food-nutrition"
              />
            </ul>
          </section>

          <section className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
            <h3 className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Important note
            </h3>
            <p className="text-white/80 text-sm leading-relaxed">
              My Perfect Meals is designed for general wellness and lifestyle support only. 
              It does not diagnose, treat, or prevent medical conditions. Always consult a 
              qualified healthcare professional for medical advice.
            </p>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SourceItemProps {
  title: string;
  description: string;
  url: string;
}

function SourceItem({ title, description, url }: SourceItemProps) {
  return (
    <li className="bg-white/5 rounded-lg p-3 border border-white/10">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <h4 className="text-white font-medium text-sm">{title}</h4>
          <p className="text-white/60 text-xs mt-0.5">{description}</p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0"
          aria-label={`Visit ${title}`}
        >
          <ExternalLink className="w-3.5 h-3.5 text-white/70" />
        </a>
      </div>
    </li>
  );
}

export default MedicalSourcesInfo;
