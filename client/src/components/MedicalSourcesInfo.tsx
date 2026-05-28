import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Info,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";

interface MedicalSourcesInfoProps {
  trigger?: React.ReactNode;
  asIconButton?: boolean;
  asPillButton?: boolean;
}

export function MedicalSourcesInfo({
  trigger,
  asIconButton = false,
  asPillButton = false,
}: MedicalSourcesInfoProps) {
  const [open, setOpen] = useState(false);

  const pillTrigger = (
    <PillButton aria-label="View sources and methodology">Info</PillButton>
  );

  const iconTrigger = (
    <PillButton aria-label="View sources and methodology">Info</PillButton>
  );

  const fullTrigger = (
    <Button
      variant="ghost"
      className="w-full justify-start text-white hover:text-white hover:bg-purple-900/20"
    >
      <BookOpen className="mr-2 h-5 w-5" />
      Medical Information & Sources
    </Button>
  );

  const defaultTrigger = asPillButton
    ? pillTrigger
    : asIconButton
      ? iconTrigger
      : fullTrigger;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger || defaultTrigger}</SheetTrigger>
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
              My Perfect Meals uses established public reference data to
              estimate calories, macronutrients, micronutrients, and nutrition
              targets. Values shown in the app are estimates and may vary based
              on ingredients, preparation methods, serving sizes, product
              brands, and individual needs.
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
              Clinical lab values &amp; biomarker reference sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Reference ranges and clinical thresholds used in the Clinical Labs
              section — including glucose, HbA1c, lipid panels, liver enzymes,
              kidney markers, and nutritional biomarkers such as prealbumin
              (transthyretin) — are informed by the following professional
              and institutional sources. These references are used for general
              health tracking and educational flagging only, not clinical
              diagnosis or individualized medical interpretation.
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="American Society for Parenteral and Enteral Nutrition (ASPEN)"
                description="Clinical guidelines for nutritional biomarkers including prealbumin (transthyretin) as a marker of nutritional status and acute-phase response in clinical nutrition assessment"
                url="https://www.nutritioncare.org/"
              />
              <SourceItem
                title="Lab Tests Online — AACC"
                description="Reference ranges, interpretation guidance, and clinical context for common laboratory markers including metabolic panels, lipid panels, liver function, and kidney function tests"
                url="https://labtestsonline.org/"
              />
              <SourceItem
                title="American Heart Association (AHA) — Cholesterol & Lipid Guidelines"
                description="Evidence-based reference ranges for LDL, HDL, total cholesterol, and triglycerides; clinical thresholds for cardiovascular risk stratification"
                url="https://www.heart.org/en/health-topics/cholesterol/about-cholesterol"
              />
              <SourceItem
                title="American Diabetes Association (ADA) — Standards of Care"
                description="Clinical reference ranges for fasting blood glucose, HbA1c, and postprandial glucose; thresholds for prediabetes and diabetes classification"
                url="https://diabetesjournals.org/care/issue/46/Supplement_1"
              />
              <SourceItem
                title="National Kidney Foundation — KDOQI Guidelines"
                description="Clinical reference thresholds for creatinine, BUN, eGFR, and kidney disease staging used to inform renal protocol activation"
                url="https://www.kidney.org/professionals/guidelines"
              />
              <SourceItem
                title="American Association for the Study of Liver Diseases (AASLD)"
                description="Reference guidance for liver enzyme interpretation (ALT, AST) and hepatic function markers used to inform liver support and liver disease protocol thresholds"
                url="https://www.aasld.org/"
              />
              <SourceItem
                title="American Thyroid Association (ATA) — TSH Reference Ranges"
                description="Clinical reference ranges for TSH, Free T4, and Free T3 used to support thyroid protocol detection and thyroid-aware meal guidance"
                url="https://www.thyroid.org/professionals/ata-professional-guidelines/"
              />
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Oncology and cancer-support nutrition references
            </h3>
            <p className="text-white/60 text-xs mb-3">
              My Perfect Meals uses publicly available oncology nutrition
              guidance and supportive care references to help inform
              cancer-support meal design patterns. These references are used to
              support general nutrition education and food-structure guidance
              only, not diagnosis, treatment, or individualized medical oncology
              care.
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="National Cancer Institute (NCI)"
                description="Cancer nutrition, treatment side effects, supportive eating strategies, and patient education"
                url="https://www.cancer.gov/about-cancer/treatment/side-effects/appetite-loss/nutrition-pdq"
              />
              <SourceItem
                title="American Cancer Society (ACS)"
                description="Nutrition and physical activity guidance for people during and after cancer treatment"
                url="https://www.cancer.org/cancer/survivorship/coping/nutrition.html"
              />
              <SourceItem
                title="Oncology Nutrition Dietetic Practice Group (Academy of Nutrition and Dietetics)"
                description="Evidence-informed oncology nutrition education and supportive nutrition care resources"
                url="https://www.oncologynutrition.org/"
              />
              <SourceItem
                title="American Society of Clinical Oncology (ASCO)"
                description="Cancer care standards, supportive care principles, and oncology practice guidance"
                url="https://www.asco.org/"
              />
              <SourceItem
                title="National Comprehensive Cancer Network (NCCN)"
                description="Supportive care and oncology-related clinical guidance frameworks"
                url="https://www.nccn.org/"
              />
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Thyroid support nutrition references
            </h3>
            <p className="text-white/60 text-xs mb-3">
              My Perfect Meals uses publicly available thyroid nutrition guidance
              to inform Thyroid Support meal design patterns. These references are
              used for general nutrition education and food-structure guidance only —
              not diagnosis, treatment, or individualized endocrinology care.
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="American Thyroid Association (ATA)"
                description="Clinical practice guidelines for hypothyroidism, Hashimoto's thyroiditis, and thyroid nutrition"
                url="https://www.thyroid.org/"
              />
              <SourceItem
                title="American Association of Clinical Endocrinology (AACE)"
                description="Evidence-based clinical endocrinology guidelines including thyroid function reference ranges"
                url="https://www.aace.com/"
              />
              <SourceItem
                title="Endocrine Society"
                description="Clinical practice guidelines for thyroid disorders, autoimmune thyroid disease, and nutrition interactions"
                url="https://www.endocrine.org/"
              />
              <SourceItem
                title="NIH Office of Dietary Supplements — Selenium"
                description="Evidence-based selenium intake guidance; selenium is essential for thyroid hormone synthesis and T4→T3 conversion"
                url="https://ods.od.nih.gov/factsheets/Selenium-HealthProfessional/"
              />
              <SourceItem
                title="NIH Office of Dietary Supplements — Iodine"
                description="Iodine reference ranges, thyroid function role, and dietary considerations for thyroid health"
                url="https://ods.od.nih.gov/factsheets/Iodine-HealthProfessional/"
              />
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Smart Scan &amp; ingredient intelligence sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Smart Scan uses two types of data: product nutrition databases
              for barcode lookups, and AI-powered ingredient analysis for label
              photo scans. Both are described below.
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="Open Food Facts"
                description="Primary source for product nutrition data retrieved via barcode scan — calories, macronutrients, fiber, sugar, and sodium values per serving. Open Food Facts is a free, open, collaborative food product database."
                url="https://world.openfoodfacts.org/"
              />
              <SourceItem
                title="UPCitemdb"
                description="Secondary source used for product name and brand identification when Open Food Facts does not have a matching product. UPCitemdb is a product catalog database; nutrition values are not sourced from this service."
                url="https://www.upcitemdb.com/"
              />
              <SourceItem
                title="USDA FoodData Central — produce &amp; whole foods"
                description="Reference data for unpackaged produce and whole foods (fresh fruits, vegetables) where no barcode exists. Nutritional values for these items are drawn from USDA FoodData Central."
                url="https://fdc.nal.usda.gov/"
              />
              <SourceItem
                title="OpenAI — ingredient label analysis"
                description="When you photograph an ingredient label, My Perfect Meals uses OpenAI's vision model to extract the ingredient list, identify potential conflicts with your health profile, generate the alignment grade (A–D), ingredient considerations, and household notes. This analysis is AI-generated, personalized to your profile, and is provided for educational purposes only — not as a medical or dietary recommendation."
                url="https://openai.com/safety"
              />
            </ul>
            <p className="text-white/60 text-xs mt-3 leading-relaxed">
              Nutrition values from barcode scans reflect the product's
              nutrition label data as recorded in the source database. Values
              may vary by product batch, region, or formulation. AI-generated
              ingredient analysis reflects the ingredients visible in the
              scanned image and may be affected by image quality, label
              legibility, and OCR accuracy.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Allergen taxonomy knowledge sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              SafetyGuard's allergen definitions and ingredient classifications
              are informed by the following public resources:
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

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Dietary protocol sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              This system is informed by recognized dietary and certification guidance from sources such as:
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="Orthodox Union (OU Kosher)"
                description="Kosher dietary law certification and ingredient standards"
                url="https://www.ou.org/kosher/"
              />
              <SourceItem
                title="Star-K Kosher Certification"
                description="Kosher compliance guidance for food production and preparation"
                url="https://www.star-k.org/"
              />
              <SourceItem
                title="OK Kosher Certification"
                description="Kosher dietary standards and ingredient classification"
                url="https://www.ok.org/"
              />
              <SourceItem
                title="Islamic Food and Nutrition Council of America (IFANCA)"
                description="Halal dietary standards, ingredient guidance, and food certification"
                url="https://www.ifanca.org/"
              />
            </ul>
            <p className="text-white/60 text-xs mt-3 leading-relaxed">
              My Perfect Meals does not hold or claim formal religious certification. For strict religious adherence, always follow the guidance of your local religious authority.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Dietary guidelines &amp; lifestyle standards
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Plant-based and lifestyle diets are informed by widely accepted nutrition and dietary guidelines.
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="Academy of Nutrition and Dietetics"
                description="Evidence-based guidance for vegetarian, vegan, and plant-based dietary patterns"
                url="https://www.eatright.org/"
              />
              <SourceItem
                title="British Dietetic Association"
                description="Peer-reviewed dietary standards for plant-based and lifestyle-based diets"
                url="https://www.bda.uk.com/"
              />
            </ul>
            <p className="text-white/60 text-xs mt-3 leading-relaxed">
              These guidelines help shape how vegetarian, vegan, and other lifestyle-based diets are applied within the system.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Companion nutrition &amp; veterinary sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              My Perfect Pets (Companion Nutrition Intelligence) uses publicly available veterinary nutrition guidelines to inform dog wellness meal design, toxic ingredient identification, and condition-specific nutritional protocols. These references are used for general wellness guidance only — not veterinary diagnosis, treatment, or individualized clinical care.
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="WSAVA Global Nutrition Guidelines"
                description="World Small Animal Veterinary Association guidelines for companion animal nutrition assessment, body condition scoring, and life-stage feeding recommendations"
                url="https://wsava.org/global-guidelines/global-nutrition-guidelines/"
              />
              <SourceItem
                title="AAHA Nutritional Assessment Guidelines for Dogs and Cats"
                description="American Animal Hospital Association evidence-based nutritional assessment protocols, weight management guidance, and therapeutic diet recommendations for companion animals"
                url="https://www.aaha.org/globalassets/02-guidelines/nutritional-assessment/nutritionalassessmentguidelines.pdf"
              />
              <SourceItem
                title="Tufts Cummings School of Veterinary Medicine — Clinical Nutrition Service"
                description="Evidence-based companion animal nutrition research including kidney disease dietary management, weight loss protocols, and therapeutic nutrition for chronic conditions"
                url="https://vetnutrition.tufts.edu/"
              />
              <SourceItem
                title="ASPCA Animal Poison Control Center"
                description="Primary authoritative reference for identifying foods, plants, and household substances toxic to dogs and cats — the foundational source for the Companion Toxic Ingredient Firewall"
                url="https://www.aspca.org/pet-care/animal-poison-control"
              />
              <SourceItem
                title="IRIS — International Renal Interest Society"
                description="Staging system and dietary management guidelines for canine chronic kidney disease, including phosphorus restriction protocols and nutritional management frameworks"
                url="https://www.iris-kidney.com/"
              />
              <SourceItem
                title="AAHA Diabetes Management Guidelines for Dogs and Cats"
                description="Evidence-based nutritional management of canine diabetes mellitus, including glycemic control principles and dietary fiber recommendations"
                url="https://www.aaha.org/globalassets/02-guidelines/diabetes-management/2018diabetesmanagementguidelines.pdf"
              />
              <SourceItem
                title="AVMA — American Veterinary Medical Association"
                description="General companion animal health and safety guidance, pet food safety standards, and wellness nutrition principles"
                url="https://www.avma.org/"
              />
            </ul>
            <p className="text-white/60 text-xs mt-3 leading-relaxed">
              Companion nutrition guidance is for general wellness support only. It does not constitute veterinary advice. Always consult a licensed veterinarian for medical conditions, significant dietary changes, or any health concern.
            </p>
          </section>

          <section className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-4">
            <h3 className="text-amber-400 font-semibold mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Important note
            </h3>
            <p className="text-white/80 text-sm leading-relaxed">
              My Perfect Meals is designed for general wellness and lifestyle
              support only. It does not diagnose, treat, or prevent medical
              conditions. SafetyGuard is a software-based assistance tool and
              cannot guarantee complete allergen avoidance. Cancer-support and
              oncology-related meal suggestions are intended for general
              supportive wellness use only and are not a substitute for
              oncology, physician, or registered dietitian guidance. Always
              verify ingredients and consult a qualified healthcare professional
              for medical advice, especially for severe allergies or medically
              complex conditions.
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
