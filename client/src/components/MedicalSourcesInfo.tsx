import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Info, BookOpen, ExternalLink, Shield, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";

interface MedicalSourcesInfoProps {
  trigger?: React.ReactNode;
  asIconButton?: boolean;
  asPillButton?: boolean;
}

export function MedicalSourcesInfo({ trigger, asIconButton = false, asPillButton = false }: MedicalSourcesInfoProps) {
  const [open, setOpen] = useState(false);

  const pillTrigger = (
    <PillButton aria-label="View sources and methodology">
      Info
    </PillButton>
  );

  const iconTrigger = (
    <PillButton aria-label="View sources and methodology">
      Info
    </PillButton>
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
          {/* MPM SafetyGuard Section */}
          <section className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4">
            <h3 className="text-emerald-400 font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5" />
              MPM SafetyGuard - How It Works
            </h3>
            <p className="text-white/80 text-sm leading-relaxed mb-4">
              MPM SafetyGuard is a two-layer guidance system designed to help reduce the risk 
              of generating meals that conflict with food allergies or medical considerations 
              provided by the user.
            </p>
            
            <div className="space-y-4 mb-4">
              <div className="bg-black/30 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <h4 className="text-white font-medium text-sm">Layer 1: Pre-Generation Safety Check</h4>
                </div>
                <p className="text-white/70 text-xs leading-relaxed pl-6">
                  Before any meal is created, the system checks the user's safety profile — including 
                  allergies and relevant medical considerations — against a structured food and 
                  ingredient taxonomy. If a requested meal includes ingredients that may conflict 
                  with the user's profile, the request is designed to be blocked before generation 
                  and the user is guided on how to adjust the request safely.
                </p>
              </div>
              
              <div className="bg-black/30 rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <Shield className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <h4 className="text-white font-medium text-sm">Layer 2: Post-Generation Validation</h4>
                </div>
                <p className="text-white/70 text-xs leading-relaxed pl-6">
                  After a meal is created, the system performs an additional validation pass 
                  intended to confirm the final ingredients remain within the user's safety 
                  constraints. If a potential conflict is detected, the meal may be flagged 
                  or adjusted.
                </p>
              </div>
            </div>

            <div className="border-t border-emerald-500/20 pt-4 mt-4">
              <h4 className="text-white font-medium text-sm mb-2">Information Sources and System Design</h4>
              <p className="text-white/70 text-xs leading-relaxed mb-3">
                MPM SafetyGuard is built using:
              </p>
              <ul className="text-white/60 text-xs space-y-1 pl-4 mb-3">
                <li>• Structured food and ingredient taxonomies</li>
                <li>• Common allergen classifications recognized by public health organizations</li>
                <li>• Clinical nutrition principles for diabetes, GLP-1 support, and anti-inflammatory eating</li>
                <li>• AI-assisted language understanding to interpret user input and ingredient intent</li>
              </ul>
              <p className="text-white/60 text-xs leading-relaxed">
                The system uses AI-assisted language understanding to identify ingredient families, 
                compound foods, and common substitutions — similar to how modern AI systems interpret 
                food, recipes, and nutrition concepts. These interpretations are combined with 
                deterministic rule-based checks to help enforce safety constraints.
              </p>
            </div>

            <div className="bg-amber-900/30 border border-amber-500/30 rounded-lg p-3 mt-4">
              <p className="text-amber-400/90 text-xs font-medium">
                SafetyGuard is a software-based guidance tool, not a medical device. It does not 
                diagnose, treat, or replace professional medical advice. All safety checks are 
                based on user-provided information and are intended to support safer food choices, 
                not medical decision-making.
              </p>
            </div>
          </section>

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
              Nutrition sources
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

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Allergen taxonomy knowledge sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              SafetyGuard's allergen definitions and ingredient classifications are informed by 
              the following public resources:
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="FDA Food Allergen Labeling (FALCPA)"
                description="Major food allergen identification and labeling requirements"
                url="https://www.fda.gov/food/food-allergensgluten-free-guidance-documents-regulatory-information/food-allergen-labeling-and-consumer-protection-act-2004-falcpa"
              />
              <SourceItem
                title="Food Allergy Research & Education (FARE)"
                description="Allergen taxonomy, cross-contamination guidance, and safe alternatives"
                url="https://www.foodallergy.org/"
              />
              <SourceItem
                title="American College of Allergy, Asthma & Immunology"
                description="Clinical allergen classification and derivative identification"
                url="https://acaai.org/allergies/allergic-conditions/food/"
              />
              <SourceItem
                title="USDA FSIS Allergen Guidelines"
                description="Hidden allergens in processed foods and ingredient derivatives"
                url="https://www.fsis.usda.gov/food-safety/food-safety-programs/food-safety-investigations"
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
              It does not diagnose, treat, or prevent medical conditions. SafetyGuard is a 
              software-based assistance tool and cannot guarantee complete allergen avoidance. 
              Always verify ingredients and consult a qualified healthcare professional for 
              medical advice, especially for severe allergies.
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
