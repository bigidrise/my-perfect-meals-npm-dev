import { useEffect, useState } from "react";
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
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillButton } from "@/components/ui/pill-button";
import { apiRequest } from "@/lib/queryClient";

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
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              🛡 Alpha-gal Syndrome — Mammalian Meat Allergy Protocol
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Alpha-gal Syndrome (AGS) is a tick-bite–triggered allergy to alpha-galactose
              (alpha-gal), a carbohydrate found in mammalian meat and fat. My Perfect Meals
              treats AGS as a clinical allergy protocol: all mammalian meats, organs, and fats
              are hard-blocked; dairy and gelatin are handled per the user's individual tolerance;
              and any ingredient that may contain hidden mammalian broth, stock, or demi-glace
              triggers a Verify Source flag. The protection level (🛡 Protected / ⚠ Verify /
              🚫 Not Compatible) is evaluated server-side from the resolved protocol and
              attached to every generated meal — the client never independently determines
              safety for this condition.
            </p>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Clinical Background</p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Commins, S.P. & Platts-Mills, T.A.E. — Tick Bites and Red Meat Allergy (PMID 22466475)"
                description="Peer-reviewed paper establishing the causal link between Lone Star tick bites and delayed IgE-mediated anaphylaxis to alpha-gal in mammalian meat. The clinical basis for treating AGS as an anaphylaxis-risk allergy, not a food preference. Current Allergy and Asthma Reports, 2013."
                url="https://pubmed.ncbi.nlm.nih.gov/22466475/"
              />
              <SourceItem
                title="Platts-Mills, T.A.E. et al. — Alpha-gal and Delayed Anaphylaxis (PMID 25956016)"
                description="Characterizes the unique delayed onset (3–6 hours post-ingestion) of AGS reactions and the spectrum of mammalian products that trigger reactions, including the conditional status of dairy and gelatin. The basis for MPM's verify-vs-block split on ambiguous ingredients."
                url="https://pubmed.ncbi.nlm.nih.gov/25956016/"
              />
            </ul>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Authoritative Guidance</p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="NIH / NIAID — Alpha-gal Syndrome"
                description="National Institute of Allergy and Infectious Diseases overview of AGS diagnosis, management, and dietary avoidance. The primary institutional source for the blocked-ingredient taxonomy used by the platform."
                url="https://www.niaid.nih.gov/diseases-conditions/alpha-gal-syndrome"
              />
              <SourceItem
                title="CDC — Alpha-gal Syndrome"
                description="Centers for Disease Control and Prevention guidance on AGS risk, tick exposure, and dietary management. Supports the inclusion of lard, tallow, and suet as hard-blocked fats alongside muscle meat."
                url="https://www.cdc.gov/ticks/alpha-gal/index.html"
              />
              <SourceItem
                title="American Academy of Allergy, Asthma & Immunology (AAAAI) — Alpha-gal Allergy"
                description="AAAAI clinical resource covering ingredient avoidance, hidden sources (gelatin capsules, certain vaccines), and management strategies for patients with confirmed AGS."
                url="https://www.aaaai.org/tools-for-the-public/conditions-library/allergies/alpha-gal-allergy"
              />
            </ul>
            <p className="text-white/60 text-xs leading-relaxed">
              MPM's Alpha-gal protocol is conservative by design. When ingredient provenance
              cannot be confirmed from available data (e.g., stock, broth, or sauce with no
              declared source), the platform returns a ⚠ Verify Source flag rather than clearing
              the meal. Users with documented severe-reaction history should always confirm
              ambiguous ingredients with their food provider before eating.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              💊 Metabolic Medication &amp; GLP-1 Nutrition Support
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Nutrition guidance for users on GLP-1 receptor agonists and dual-agonist
              medications (Ozempic, Wegovy, Mounjaro, Zepbound, Rybelsus, and similar)
              is informed by the following authoritative sources. These references
              underpin the platform's meal adjustments, symptom-aware recommendations,
              hydration emphasis, and safety escalation logic for metabolic medication
              users. This guidance is for general nutritional support only — not
              medical advice, diagnosis, or treatment. Always follow your prescribing
              physician's instructions.
            </p>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Recognized Side Effects &amp; Dehydration Risk</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Daily Tolerance Check-in · Symptom Recognition · Escalation Triggers
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="FDA — Semaglutide (Ozempic / Wegovy) Prescribing Information, 2025"
                description="Official FDA prescribing information identifying nausea, vomiting, diarrhea, constipation, abdominal pain, and dyspepsia as common adverse reactions (§6.1), and documenting dehydration and acute kidney injury risk from persistent GI effects (§5.1). The basis for symptom recognition and escalation triggers."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf"
              />
              <SourceItem
                title="FDA — Tirzepatide (Mounjaro / Zepbound) Prescribing Information, 2025"
                description="Official FDA prescribing information for the GIP/GLP-1 dual agonist tirzepatide, documenting the same GI adverse reaction profile and dehydration risk. Applies to users on Mounjaro or Zepbound."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/215866s039lbl.pdf"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Nutrition During GI Symptoms</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: GLP-1 Builder · Snack Creator · Meal Builders · Grocery Coach · Beverage Creator · Coach's Corner · Craving Creator · Fridge Rescue · Restaurant Guide · Getaways &amp; Travel Dining · Buffet Guidance · Find Your Meals · Weekly Meal Plan
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Clinical Recommendations to Manage GI Adverse Events in GLP-1 RA Patients — Gut (BMJ), 2023"
                description="Peer-reviewed consensus paper (PMID 36614945) providing clinical dietary recommendations for managing GLP-1 gastrointestinal side effects. Supports smaller meals, lower-fat foods, neutral flavors, avoidance of carbonated beverages, and protein priority for lean mass preservation."
                url="https://pubmed.ncbi.nlm.nih.gov/36614945/"
              />
              <SourceItem
                title="Academy of Nutrition and Dietetics — Weight Management & Metabolic Health"
                description="Evidence-based nutrition practice guidance for metabolic medication users, including protein and fiber recommendations during appetite suppression, and hydration paired with fiber for constipation management."
                url="https://www.eatright.org/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Hydration &amp; Dehydration Risk</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Water Signal Integration · Grocery Coach · Beverage Creator · Escalation
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="FDA Prescribing Information — Dehydration Warning (§5.1)"
                description="FDA labeling for both semaglutide and tirzepatide explicitly warns that GI adverse effects can lead to dehydration and acute kidney injury. This is the primary basis for making hydration a first-class daily behavioral signal for metabolic medication users."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf"
              />
              <SourceItem
                title="NIDDK — Gastroparesis: Symptoms, Causes & Eating Guidelines"
                description="National Institute of Diabetes and Digestive and Kidney Diseases guidance on delayed gastric emptying — a documented pharmacological effect of GLP-1 medications. Supports avoidance of raw cruciferous vegetables and high insoluble fiber foods; supports hydration emphasis and smaller, softer meals."
                url="https://www.niddk.nih.gov/health-information/digestive-diseases/gastroparesis/symptoms-causes"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">GI Symptom Management — Reflux &amp; Diarrhea</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Daily Tolerance Check-in · GLP-1 Builder · Coach's Corner
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="American Gastroenterological Association (AGA) — GI Symptom Dietary Guidance"
                description="AGA clinical dietary guidance for reflux, dyspepsia, and diarrhea management — the basis for acidic food avoidance when reflux is reported, and reduced insoluble fiber when diarrhea is active."
                url="https://www.gastro.org/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Safety Escalation</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Escalation Message · Provider Notification Language
            </p>
            <ul className="space-y-3 mb-4">
              <SourceItem
                title="FDA Prescribing Information — Adverse Reactions &amp; Warnings (§5.1, §6.1)"
                description="FDA labeling explicitly states that persistent vomiting can cause dehydration and acute kidney injury requiring medical attention. This is the clinical basis for the escalation message displayed to users who report vomiting or significant difficulty staying hydrated."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf"
              />
            </ul>

            <p className="text-white/60 text-xs leading-relaxed">
              Every nutrition rule applied to GLP-1 medication users is traceable to one or more
              of the sources above. Directional guidance (smaller portions, lower fat, protein
              priority) reflects the published clinical evidence. Specific numerical targets
              (protein grams, fat ceilings, calorie ranges) are either derived from the user's
              macro calculator or set by their prescribing provider — not invented by the platform.
              The evidence framework activates through three pathways: selection of the GLP-1
              Builder by the user, a physician-assigned metabolic medication condition via ProCare,
              or a specialtyCondition flag on the user's profile — ensuring the resolver engages
              regardless of how the clinical context was established.
            </p>
          </section>

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
              kidney markers, thyroid markers (TSH, Free T4, Free T3, Reverse T3),
              hormone markers (Total Testosterone, Free Testosterone, DHEA-S,
              Estradiol, Progesterone, FSH, LH, SHBG), and nutritional biomarkers
              such as prealbumin (transthyretin) — are informed by the following
              professional and institutional sources. These references are used for
              general health tracking and educational flagging only, not clinical
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
                description="Clinical reference ranges for TSH, Free T4, Free T3, and Reverse T3 (rT3) used to support thyroid protocol detection, subtype classification (hypothyroid, hyperthyroid, Hashimoto's), and thyroid-aware meal guidance"
                url="https://www.thyroid.org/professionals/ata-professional-guidelines/"
              />
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Hormone &amp; menopause nutrition references
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Clinical thresholds and nutrition guidance for Hormone Optimization,
              Menopause, and Perimenopause protocols — including testosterone,
              DHEA-S, Estradiol, FSH, LH, Progesterone, and SHBG reference ranges —
              are informed by the following professional and institutional sources.
              These references are used for general nutrition education and
              food-structure guidance only, not diagnosis, treatment, or
              individualized endocrinology or gynecology care.
            </p>
            <ul className="space-y-3">
              <SourceItem
                title="North American Menopause Society (NAMS)"
                description="Evidence-based guidelines for menopause and perimenopause hormone reference ranges, FSH/Estradiol thresholds, and nutrition strategies for bone density, muscle preservation, and phytoestrogen guidance"
                url="https://www.menopause.org/for-women"
              />
              <SourceItem
                title="American College of Obstetricians and Gynecologists (ACOG)"
                description="Clinical guidance for menopause transition, perimenopause staging, hormone reference ranges, and nutritional considerations during the reproductive-to-menopause transition"
                url="https://www.acog.org/womens-health/faqs/the-menopause-years"
              />
              <SourceItem
                title="American Urological Association (AUA) — Testosterone Deficiency Guidelines"
                description="Evidence-based thresholds for Total Testosterone and Free Testosterone used to inform Hormone Optimization protocol activation; clinical reference for low testosterone and nutritional support strategies"
                url="https://www.auanet.org/guidelines-and-quality/guidelines/testosterone-deficiency-guideline"
              />
              <SourceItem
                title="Endocrine Society — Hormone Clinical Practice Guidelines"
                description="Clinical practice guidelines for testosterone deficiency, DHEA-S reference ranges, menopause hormone thresholds, and endocrine nutrition interactions used in hormone protocol design"
                url="https://www.endocrine.org/clinical-practice-guidelines"
              />
              <SourceItem
                title="NIH Office of Dietary Supplements — Calcium &amp; Vitamin D"
                description="Evidence-based dietary reference intakes for calcium and Vitamin D — foundational nutrients prioritized in the Menopause Support protocol for bone density preservation"
                url="https://ods.od.nih.gov/factsheets/Calcium-HealthProfessional/"
              />
              <SourceItem
                title="NIH — Phytoestrogens and Menopause (NIH/NCCIH)"
                description="Research context for dietary phytoestrogens (flaxseed, soy, edamame) and their role in menopausal nutrition support — the basis for phytoestrogen inclusion in the Menopause Support protocol"
                url="https://www.nccih.nih.gov/health/menopausal-symptoms-in-depth"
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
              🐾 Companion Animal Nutrition
            </h3>
            <p className="text-white/60 text-xs mb-4">
              My Perfect Pets (Companion Nutrition Intelligence) uses publicly available veterinary nutrition guidelines to inform wellness meal design, toxic ingredient identification, and condition-specific nutritional protocols for dogs and cats. Both species have separate protocol engines — canine and feline logic are never mixed. These references are for general wellness guidance only — not veterinary diagnosis, treatment, or individualized clinical care.
            </p>

            {/* Shared foundation sources */}
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="WSAVA Global Nutrition Guidelines"
                description="World Small Animal Veterinary Association guidelines for companion animal nutrition assessment, body condition scoring, and life-stage feeding recommendations for both dogs and cats"
                url="https://wsava.org/global-guidelines/global-nutrition-guidelines/"
              />
              <SourceItem
                title="AAHA Nutritional Assessment Guidelines for Dogs and Cats"
                description="American Animal Hospital Association evidence-based nutritional assessment protocols, weight management guidance, and therapeutic diet recommendations for companion animals"
                url="https://www.aaha.org/globalassets/02-guidelines/nutritional-assessment/nutritionalassessmentguidelines.pdf"
              />
              <SourceItem
                title="Tufts Cummings School of Veterinary Medicine — Clinical Nutrition Service"
                description="Evidence-based companion animal nutrition research including kidney disease dietary management, weight loss protocols, and therapeutic nutrition for chronic conditions in dogs and cats"
                url="https://vetnutrition.tufts.edu/"
              />
              <SourceItem
                title="ASPCA Animal Poison Control Center"
                description="Primary authoritative reference for identifying foods, plants, and household substances toxic to dogs and cats — the foundational source for both the Canine and Feline Toxic Ingredient Firewalls"
                url="https://www.aspca.org/pet-care/animal-poison-control"
              />
              <SourceItem
                title="IRIS — International Renal Interest Society"
                description="Staging system and dietary management guidelines for canine and feline chronic kidney disease, including phosphorus restriction protocols and nutritional management frameworks"
                url="https://www.iris-kidney.com/"
              />
              <SourceItem
                title="AAHA Diabetes Management Guidelines for Dogs and Cats"
                description="Evidence-based nutritional management of diabetes mellitus in dogs and cats — including species-specific differences: very low carbohydrate is the primary feline intervention; fiber-based management for dogs"
                url="https://www.aaha.org/globalassets/02-guidelines/diabetes-management/2018diabetesmanagementguidelines.pdf"
              />
              <SourceItem
                title="AVMA — American Veterinary Medical Association"
                description="General companion animal health and safety guidance, pet food safety standards, and wellness nutrition principles"
                url="https://www.avma.org/"
              />
            </ul>

            {/* Canine Nutrition subsection */}
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">🐕 Canine Nutrition</p>
            <p className="text-white/50 text-xs mb-3">
              Dog protocols — including life-stage feeding, wellness goal stacks (joint, kidney, weight, diabetes, digestive, skin), and the canine toxic ingredient firewall — are informed by the following additional references.
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="AAHA Senior Care Guidelines for Dogs and Cats"
                description="Nutritional recommendations for aging companion animals — protein maintenance, kidney-aware phosphorus management, and antioxidant support for senior dogs"
                url="https://www.aaha.org/resources/senior-care-guidelines/"
              />
              <SourceItem
                title="Veterinary Evidence Journal — Omega-3 and Canine Osteoarthritis"
                description="Evidence for EPA/DHA supplementation in canine joint health management — the basis for joint wellness protocol ingredient selection"
                url="https://veterinaryevidence.org/"
              />
              <SourceItem
                title="Journal of Veterinary Dermatology — Nutritional Approach to Skin Disorders"
                description="Dietary fatty acids, biotin, and zinc in canine dermatological health — supporting the skin and coat wellness protocol"
                url="https://onlinelibrary.wiley.com/journal/13652621"
              />
              <SourceItem
                title="Canine Sports Medicine and Rehabilitation — Nutritional Requirements"
                description="Macronutrient requirements and caloric density guidance for athletic and working dogs — the basis for the active dog performance nutrition protocol"
                url="https://www.avma.org/"
              />
            </ul>

            {/* Feline Nutrition subsection */}
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">🐈 Feline Nutrition</p>
            <p className="text-white/50 text-xs mb-3">
              Cat protocols are built on feline-specific nutritional science. Cats are obligate carnivores with fundamentally different metabolic requirements from dogs. The feline protocol engine includes 15 condition-specific wellness protocols, a dedicated feline toxicity firewall, and mandatory taurine enforcement in every recipe.
            </p>
            <ul className="space-y-3 mb-4">
              <SourceItem
                title="NRC Nutrient Requirements of Cats, 2006"
                description="National Research Council foundational reference for feline essential nutrients — including taurine as an essential amino acid, preformed vitamin A from animal tissue, arachidonic acid from animal fat, and obligate carnivore protein requirements. The primary reference for all feline nutrient minimum values."
                url="https://nap.nationalacademies.org/catalog/10668/nutrient-requirements-of-dogs-and-cats"
              />
              <SourceItem
                title="Journal of Veterinary Internal Medicine — Taurine and Feline Cardiomyopathy"
                description="Evidence linking dietary taurine deficiency to dilated cardiomyopathy (DCM) in cats — the basis for mandatory taurine enforcement in every cat recipe and the feline taurine optimization protocol"
                url="https://onlinelibrary.wiley.com/journal/19391676"
              />
              <SourceItem
                title="AAHA Senior Care Guidelines for Dogs and Cats"
                description="Feline senior nutrition: high-protein requirement for sarcopenia prevention, kidney-aware phosphorus management, and the updated guidance that protein should NOT be routinely restricted in senior cats without confirmed kidney disease"
                url="https://www.aaha.org/resources/senior-care-guidelines/"
              />
              <SourceItem
                title="Journal of Veterinary Dermatology — Nutritional Approach to Feline Skin Disorders"
                description="Dietary fatty acids and taurine in feline dermatological health — supporting the feline skin and coat wellness protocol. Cats require arachidonic acid from animal fat sources, not plant-derived omega-6 precursors."
                url="https://onlinelibrary.wiley.com/journal/13652621"
              />
              <SourceItem
                title="Journal of Veterinary Internal Medicine — Omega-3 Fatty Acids in Feline Nutrition"
                description="EPA and DHA from marine sources for anti-inflammatory benefit in cats — cats cannot efficiently convert plant-based ALA; marine-derived EPA/DHA required for effective anti-inflammatory support"
                url="https://onlinelibrary.wiley.com/journal/19391676"
              />
              <SourceItem
                title="FDA — Propylene Glycol in Cat Food (21 CFR 582.1666)"
                description="FDA regulatory determination that propylene glycol is unsafe for cats — Heinz body anemia risk. The basis for propylene glycol inclusion in the Feline Toxic Ingredient Firewall."
                url="https://www.fda.gov/animal-veterinary/animal-food-feeds/ingredients-food-animals"
              />
            </ul>

            <p className="text-white/60 text-xs leading-relaxed">
              Companion nutrition guidance is for general wellness support only and does not constitute veterinary advice. Always consult a licensed veterinarian for medical conditions, significant dietary changes, urinary blockages, kidney disease, diabetes, or any health concern affecting your pet.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              🩷 Pregnancy Support nutrition &amp; food safety references
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Pregnancy Support nutrition guidance — including trimester-specific nutrient priorities, food safety
              screening (mercury, listeria, raw food risk), and breastfeeding/postpartum nutrition — is informed
              by the following professional and institutional sources. This guidance is used for general nutrition
              education and food-structure support only, not obstetric diagnosis, treatment, or individualized
              prenatal medical care. Always follow your OB/GYN or midwife's recommendations first.
            </p>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2 mt-4">Nutrition &amp; Pregnancy</p>
            <ul className="space-y-3 mb-4">
              <SourceItem
                title="American College of Obstetricians and Gynecologists (ACOG)"
                description="Clinical guidance for prenatal nutrition, gestational weight gain, nutrient requirements by trimester, and postpartum dietary recommendations"
                url="https://www.acog.org/womens-health/faqs/nutrition-during-pregnancy"
              />
              <SourceItem
                title="Society for Maternal-Fetal Medicine (SMFM)"
                description="Evidence-based guidelines for high-risk pregnancy nutrition, gestational diabetes management, and fetal growth nutrition considerations"
                url="https://www.smfm.org/"
              />
              <SourceItem
                title="Academy of Nutrition and Dietetics (AND)"
                description="Evidence-based nutrition practice guidelines for pregnancy and lactation, including macronutrient targets, iron, calcium, DHA, and folate recommendations"
                url="https://www.eatright.org/health/pregnancy/prenatal-wellness/eating-right-during-pregnancy"
              />
              <SourceItem
                title="NIH Office of Dietary Supplements — Folate, Iron, Calcium &amp; DHA"
                description="Dietary reference intakes and evidence-based guidance for key pregnancy nutrients including folate, iron, calcium, iodine, and omega-3 DHA for fetal development"
                url="https://ods.od.nih.gov/factsheets/list-all/"
              />
              <SourceItem
                title="Centers for Disease Control and Prevention (CDC) — Pregnancy Nutrition"
                description="Public health nutrition recommendations for pregnancy, including folic acid guidance, gestational weight gain targets, and prenatal nutrition education"
                url="https://www.cdc.gov/nutrition/pregnancy-breastfeeding/index.html"
              />
            </ul>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Food Safety During Pregnancy</p>
            <ul className="space-y-3 mb-4">
              <SourceItem
                title="U.S. Food &amp; Drug Administration (FDA) — Pregnancy Food Safety"
                description="Evidence-based guidance on fish consumption during pregnancy, mercury content by species, safe mercury limits, and foods to avoid including unpasteurized products, raw seafood, and deli meats"
                url="https://www.fda.gov/food/consumers/advice-about-eating-fish"
              />
              <SourceItem
                title="Centers for Disease Control and Prevention (CDC) — Listeria &amp; Pregnancy"
                description="Listeria risk identification, high-risk foods during pregnancy (deli meats, soft cheeses, sprouts, ready-to-eat foods), and safe food handling guidance"
                url="https://www.cdc.gov/listeria/risk-groups/pregnant-women.html"
              />
              <SourceItem
                title="U.S. Environmental Protection Agency (EPA) — Mercury in Fish"
                description="Mercury exposure guidelines, species-specific mercury content classification (high / moderate / low), and safe fish consumption limits for pregnant and breastfeeding women"
                url="https://www.epa.gov/fish-tech/advice-about-eating-fish-those-who-might-become-or-are-pregnant-breastfeeding-mothers-young"
              />
            </ul>
            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Breastfeeding &amp; Postpartum</p>
            <ul className="space-y-3">
              <SourceItem
                title="American Academy of Pediatrics (AAP)"
                description="Breastfeeding nutrition guidelines, DHA and iodine requirements during lactation, caloric needs for breastfeeding mothers, and postpartum recovery nutrition"
                url="https://www.healthychildren.org/English/ages-stages/baby/breastfeeding/Pages/default.aspx"
              />
              <SourceItem
                title="World Health Organization (WHO) — Infant &amp; Young Child Feeding"
                description="International breastfeeding and complementary feeding guidelines, maternal nutrition during lactation, and postpartum nutritional recovery recommendations"
                url="https://www.who.int/health-topics/breastfeeding"
              />
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              💊 Metabolic Medication &amp; GLP-1 Nutrition Support
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Nutrition guidance for users on GLP-1 receptor agonists and dual-agonist
              medications (Ozempic, Wegovy, Mounjaro, Zepbound, Rybelsus, and similar)
              is informed by the following authoritative sources. These references
              underpin the platform's meal adjustments, symptom-aware recommendations,
              hydration emphasis, and safety escalation logic for metabolic medication
              users. This guidance is for general nutritional support only — not
              medical advice, diagnosis, or treatment. Always follow your prescribing
              physician's instructions.
            </p>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Recognized Side Effects &amp; Dehydration Risk</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Daily Tolerance Check-in · Symptom Recognition · Escalation Triggers
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="FDA — Semaglutide (Ozempic / Wegovy) Prescribing Information, 2025"
                description="Official FDA prescribing information identifying nausea, vomiting, diarrhea, constipation, abdominal pain, and dyspepsia as common adverse reactions (§6.1), and documenting dehydration and acute kidney injury risk from persistent GI effects (§5.1). The basis for symptom recognition and escalation triggers."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf"
              />
              <SourceItem
                title="FDA — Tirzepatide (Mounjaro / Zepbound) Prescribing Information, 2025"
                description="Official FDA prescribing information for the GIP/GLP-1 dual agonist tirzepatide, documenting the same GI adverse reaction profile and dehydration risk. Applies to users on Mounjaro or Zepbound."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/215866s039lbl.pdf"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Nutrition During GI Symptoms</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: GLP-1 Builder · Snack Creator · Meal Builders · Grocery Coach · Beverage Creator · Coach's Corner · Craving Creator · Fridge Rescue · Restaurant Guide · Getaways &amp; Travel Dining · Buffet Guidance · Find Your Meals · Weekly Meal Plan
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Clinical Recommendations to Manage GI Adverse Events in GLP-1 RA Patients — Gut (BMJ), 2023"
                description="Peer-reviewed consensus paper (PMID 36614945) providing clinical dietary recommendations for managing GLP-1 gastrointestinal side effects. Supports smaller meals, lower-fat foods, neutral flavors, avoidance of carbonated beverages, and protein priority for lean mass preservation."
                url="https://pubmed.ncbi.nlm.nih.gov/36614945/"
              />
              <SourceItem
                title="Academy of Nutrition and Dietetics — Weight Management & Metabolic Health"
                description="Evidence-based nutrition practice guidance for metabolic medication users, including protein and fiber recommendations during appetite suppression, and hydration paired with fiber for constipation management."
                url="https://www.eatright.org/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Hydration &amp; Dehydration Risk</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Water Signal Integration · Grocery Coach · Beverage Creator · Escalation
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="FDA Prescribing Information — Dehydration Warning (§5.1)"
                description="FDA labeling for both semaglutide and tirzepatide explicitly warns that GI adverse effects can lead to dehydration and acute kidney injury. This is the primary basis for making hydration a first-class daily behavioral signal for metabolic medication users."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf"
              />
              <SourceItem
                title="NIDDK — Gastroparesis: Symptoms, Causes & Eating Guidelines"
                description="National Institute of Diabetes and Digestive and Kidney Diseases guidance on delayed gastric emptying — a documented pharmacological effect of GLP-1 medications. Supports avoidance of raw cruciferous vegetables and high insoluble fiber foods; supports hydration emphasis and smaller, softer meals."
                url="https://www.niddk.nih.gov/health-information/digestive-diseases/gastroparesis/symptoms-causes"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">GI Symptom Management — Reflux &amp; Diarrhea</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Daily Tolerance Check-in · GLP-1 Builder · Coach's Corner
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="American Gastroenterological Association (AGA) — GI Symptom Dietary Guidance"
                description="AGA clinical dietary guidance for reflux, dyspepsia, and diarrhea management — the basis for acidic food avoidance when reflux is reported, and reduced insoluble fiber when diarrhea is active."
                url="https://www.gastro.org/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Safety Escalation</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Escalation Message · Provider Notification Language
            </p>
            <ul className="space-y-3 mb-4">
              <SourceItem
                title="FDA Prescribing Information — Adverse Reactions &amp; Warnings (§5.1, §6.1)"
                description="FDA labeling explicitly states that persistent vomiting can cause dehydration and acute kidney injury requiring medical attention. This is the clinical basis for the escalation message displayed to users who report vomiting or significant difficulty staying hydrated."
                url="https://www.accessdata.fda.gov/drugsatfda_docs/label/2025/209637s025lbl.pdf"
              />
            </ul>

            <p className="text-white/60 text-xs leading-relaxed">
              Every nutrition rule applied to GLP-1 medication users is traceable to one or more
              of the sources above. Directional guidance (smaller portions, lower fat, protein
              priority) reflects the published clinical evidence. Specific numerical targets
              (protein grams, fat ceilings, calorie ranges) are either derived from the user's
              macro calculator or set by their prescribing provider — not invented by the platform.
              The evidence framework activates through three pathways: selection of the GLP-1
              Builder by the user, a physician-assigned metabolic medication condition via ProCare,
              or a specialtyCondition flag on the user's profile — ensuring the resolver engages
              regardless of how the clinical context was established.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3">
              Protocol Priority Framework
            </h3>
            <p className="text-white/70 text-sm leading-relaxed mb-4">
              When multiple health protocols are active simultaneously, My Perfect Meals resolves conflicts using a fixed priority hierarchy. Clinical safety always wins. No user preference can override a medical hard limit.
            </p>
            <div className="space-y-2 mb-4">
              {[
                { tier: "1", label: "Clinical Safety", detail: "Hard medical limits — kidney, cardiac, oncology, allergy. Never overridden.", color: "text-red-400", bg: "bg-red-500/10 border-red-500/25" },
                { tier: "2", label: "Medical Hard Limits", detail: "Physician-assigned restrictions: blood glucose, sodium, potassium, phosphorus thresholds.", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/25" },
                { tier: "3", label: "Therapeutic Protocols", detail: "Anti-inflammatory, thyroid, hormone, liver, GLP-1 support layers.", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/25" },
                { tier: "4", label: "Performance Overlay", detail: "Athletic fueling, carbohydrate timing, sport-specific demands.", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/25" },
                { tier: "5", label: "Dietary Identity", detail: "Vegan, keto, gluten-free, halal, and other self-selected diet patterns.", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/25" },
                { tier: "6", label: "Culinary Preference", detail: "Cuisine style, heat level, ingredient likes and dislikes.", color: "text-white/50", bg: "bg-white/5 border-white/10" },
              ].map(p => (
                <div key={p.tier} className={`flex items-start gap-3 rounded-lg p-3 border ${p.bg}`}>
                  <span className={`text-xs font-bold ${p.color} flex-shrink-0 mt-0.5 w-4`}>{p.tier}</span>
                  <div>
                    <p className={`text-sm font-semibold ${p.color}`}>{p.label}</p>
                    <p className="text-white/50 text-xs mt-0.5 leading-snug">{p.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <ul className="space-y-3">
              <SourceItem
                title="American Diabetes Association (ADA)"
                description="Evidence-based standards of medical care in diabetes — the clinical foundation for blood glucose management and carbohydrate guidance"
                url="https://diabetesjournals.org/care/issue/47/Supplement_1"
              />
              <SourceItem
                title="American College of Sports Medicine (ACSM)"
                description="Position stands on nutrition and athletic performance — the basis for performance overlay carbohydrate timing and protein guidance"
                url="https://www.acsm.org/education-resources/trending-topics-resources/physical-activity-guidelines"
              />
              <SourceItem
                title="National Kidney Foundation (NKF)"
                description="Clinical practice guidelines for nutrition in chronic kidney disease — potassium, phosphorus, and protein limits"
                url="https://www.kidney.org/professionals/guidelines"
              />
              <SourceItem
                title="American Heart Association (AHA)"
                description="Dietary guidelines for cardiovascular health — sodium limits, saturated fat restrictions, and heart-healthy food priorities"
                url="https://www.heart.org/en/healthy-living/healthy-eating/eat-smart/nutrition-basics"
              />
              <SourceItem
                title="American Thyroid Association (ATA)"
                description="Clinical guidelines for thyroid disease management — medication timing, selenium, iodine, and goitrogen considerations"
                url="https://www.thyroid.org/professionals/ata-professional-guidelines/"
              />
              <SourceItem
                title="Endocrine Society"
                description="Clinical practice guidelines for hormone optimization, menopause, and metabolic health — the basis for hormone-balancing nutrition"
                url="https://www.endocrine.org/clinical-practice-guidelines"
              />
              <SourceItem
                title="American Society of Clinical Oncology (ASCO)"
                description="Oncology nutrition guidance — nutrient density, immune support, and symptom-aware meal planning for cancer support"
                url="https://www.asco.org/practice-patients/cancer-topics/cancer-prevention-survivorship"
              />
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              🧠 Behavior &amp; Coaching Science
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Chef's Corner collects a Behavioral Profile — a short coaching intake that
              learns how you make decisions, what motivates you, how you respond to setbacks,
              and how you prefer to be coached. This is not a psychological assessment or
              clinical instrument. It is a coaching tool, designed to feel like a coach
              getting to know you before your first session. The behavioral constructs
              it uses are grounded in the following established frameworks. Each source
              is listed with the specific concept it supports and how that concept appears
              in the system.
            </p>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Self-Efficacy</p>
            <p className="text-white/40 text-xs mb-2">
              Concept: Confidence in one's ability to perform a behavior predicts whether that behavior will be attempted and sustained. Drives: coaching language that frames goals as achievable steps · avoids language that implies fixed capability · celebrates consistency over perfection.
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Bandura, A. — Self-Efficacy: Toward a Unifying Theory of Behavioral Change (1977)"
                description="The foundational paper establishing self-efficacy as a central determinant of behavior change. My Perfect Meals coaching language is explicitly designed to build perceived capability — presenting goals as learnable, recoverable, and within reach — rather than implying fixed-trait success or failure."
                url="https://psycnet.apa.org/record/1977-25733-001"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Self-Determination Theory</p>
            <p className="text-white/40 text-xs mb-2">
              Concept: Intrinsic motivation and long-term behavior change depend on satisfying three psychological needs — autonomy (choice), competence (mastery), and relatedness (connection). Drives: autonomy-supportive coaching language ("build what sounds right") · competence framing in daily check-in interventions · relatedness in accountability and progress acknowledgment.
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Deci, E.L. & Ryan, R.M. — The 'What' and 'Why' of Goal Pursuits (Psychological Inquiry, 2000)"
                description="Core academic statement of Self-Determination Theory. The coaching intake's autonomy questions — how directive vs. collaborative you want coaching to be — directly reflect SDT's autonomy dimension. The system avoids prescriptive commands and instead frames direction as a choice."
                url="https://selfdeterminationtheory.org/theory/"
              />
              <SourceItem
                title="Teixeira, P. et al. — Motivation, Self-Determination, and Long-Term Weight Control (International Journal of Behavioral Nutrition, 2012, PMID 22385818)"
                description="Empirical support for autonomy-supportive nutritional coaching over directive instruction in sustained dietary behavior. Basis for minimizing prescriptive food lists and favoring direction-first coaching across the system."
                url="https://pubmed.ncbi.nlm.nih.gov/22385818/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Stages of Change (Transtheoretical Model)</p>
            <p className="text-white/40 text-xs mb-2">
              Concept: Behavior change unfolds through distinct stages — precontemplation, contemplation, preparation, action, maintenance. Effective coaching meets people where they are rather than assuming readiness. Drives: ACE intervention selection · readiness language in the coaching intake · recovery-framing on off-plan days.
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Prochaska, J.O. & DiClemente, C.C. — Stages and Processes of Self-Change (Journal of Consulting and Clinical Psychology, 1983, PMID 6863699)"
                description="Original empirical paper introducing the Transtheoretical Model of behavior change. The ACE Intervention Library is structured to activate different coaching messages depending on a user's current behavioral signals — a practical application of stage-matched intervention design."
                url="https://pubmed.ncbi.nlm.nih.gov/6863699/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Motivational Interviewing</p>
            <p className="text-white/40 text-xs mb-2">
              Concept: A collaborative, goal-oriented conversational style that draws out a person's own motivation rather than prescribing change. Drives: Chef's Corner conversational approach · explore-don't-prescribe coaching philosophy · craving-aware and emotional eating interventions.
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Miller, W.R. & Rollnick, S. — Motivational Interviewing: Helping People Change (3rd ed., 2013)"
                description="The primary reference for motivational interviewing as a coaching communication framework. Chef's Corner is designed to draw out the user's own context and reasoning rather than prescribe behavior — asking what they want, reflecting their situation, and offering options rather than instructions."
                url="https://www.motivationalinterviewing.org/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Habit Formation</p>
            <p className="text-white/40 text-xs mb-2">
              Concept: Habits form through consistent repetition in stable contexts — not through willpower or motivation alone. Average habit formation takes 66 days, not 21. Drives: consistency-first messaging in neutral-day ACE coaching · repetition-emphasis in meal planning guidance.
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Lally, P. et al. — How Are Habits Formed: Modelling Habit Formation in the Real World (European Journal of Social Psychology, 2010)"
                description="Empirical study finding that habit formation in real-world dietary and exercise contexts takes an average of 66 days (range 18–254). The basis for the system's consistency-first coaching posture — prioritizing repetition and context stability over intensity or restriction."
                url="https://doi.org/10.1002/ejsp.674"
              />
              <SourceItem
                title="Gardner, B., Lally, P. & Wardle, J. — Making Health Habitual (British Journal of General Practice, 2012, PMID 23211256)"
                description="Practical translation of habit research for health behavior change contexts. Supports the coaching design principle of anchoring meal behaviors to consistent daily contexts (same time, same trigger, same environment) rather than relying on sustained motivation."
                url="https://pubmed.ncbi.nlm.nih.gov/23211256/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Recovery &amp; Non-Judgmental Framing</p>
            <p className="text-white/40 text-xs mb-2">
              Concept: Off-plan days are normal and expected — framing them as failure increases the risk of full abandonment. Effective coaching treats them as data, not character flaws. Drives: off-plan day language in ACE · Chef's Corner recovery responses · avoidance of restriction-based framing.
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Norcross, J.C. et al. — In Session: Psychotherapy in Practice — Stages of Change (Journal of Clinical Psychology, 2011, PMID 21188747)"
                description="Evidence review supporting non-judgmental relapse framing in behavior change coaching. Basis for the coaching principle that a missed day or off-plan meal should be acknowledged and contextualized, not penalized — because punitive framing accelerates disengagement."
                url="https://pubmed.ncbi.nlm.nih.gov/21188747/"
              />
            </ul>

            <p className="text-white/60 text-xs leading-relaxed">
              The Behavioral Profile collected during the Chef's Corner intake is a coaching tool, not a psychological test or clinical assessment. Its purpose is to shape how the system communicates with you — not to diagnose, categorize, or make clinical inferences from your answers. No behavioral response in the intake is used to draw clinical conclusions.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              🤰 Pregnancy Coach — Evidence &amp; Guidance Sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Pregnancy Coach is the conversational layer of My Perfect Pregnancy. Every
              coaching response is grounded in the user's current stage (trying to conceive
              through postpartum) and the food safety and nutrient rules that are actively
              enforced across all meal generators. The following sources are the clinical
              and regulatory basis for those rules. Each citation identifies the specific
              My Perfect Meals behavior it supports.
            </p>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Food Safety Rules — Blocked Ingredients</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Hard blocks on raw fish · deli meats · high-mercury fish · unpasteurized soft cheeses · raw eggs · alcohol across all meal generators
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="FDA & EPA — Advice About Eating Fish (2024)"
                description="Joint FDA/EPA guidance establishing the mercury risk tiers used in the platform: AVOID (shark, swordfish, king mackerel, tilefish, bigeye tuna, orange roughy, marlin), LIMIT (albacore tuna, halibut, mahi-mahi, grouper), and BEST CHOICES (salmon, sardines, trout, shrimp, catfish, canned light tuna). The hard-block list maps directly to the AVOID tier."
                url="https://www.fda.gov/food/consumers/advice-about-eating-fish"
              />
              <SourceItem
                title="ACOG Practice Bulletin — Nutrition During Pregnancy (2021)"
                description="American College of Obstetricians and Gynecologists clinical guidance establishing the blocked-food list: raw or undercooked fish and shellfish (listeria, toxoplasma risk), deli meats and hot dogs unless heated to steaming (listeria risk), unpasteurized soft cheeses (listeria risk), raw or soft-boiled eggs (salmonella risk), and alcohol (no safe level established). Every blocked ingredient in the pregnancy protocol traces directly to ACOG or FDA guidance."
                url="https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2021/04/nutrition-during-pregnancy"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Trimester-Specific Nutrient Priorities</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: T1 folate/iron focus · T2 calcium/protein/vitamin D · T3 DHA/choline/iron · Postpartum fiber/omega-3/protein · Breastfeeding iodine/DHA/+500 kcal
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="NIH Office of Dietary Supplements — Nutrient Fact Sheets (Folate, Iron, Calcium, DHA, Choline, Iodine)"
                description="The authoritative source for the specific nutrient targets used by trimester: folate 600–800 mcg (T1, neural tube), iron 27mg (T1–T3, oxygen transport), calcium 1,000mg (T2, fetal bone), DHA 200–300mg (T3/breastfeeding, brain development), choline 450mg (T3, brain and spinal cord), iodine 290 mcg (breastfeeding, thyroid function). All targets are drawn directly from NIH DRI values."
                url="https://ods.od.nih.gov/factsheets/list-all/"
              />
              <SourceItem
                title="National Academies — Weight Gain During Pregnancy: Reexamining the Guidelines (IOM, 2009)"
                description="Institute of Medicine report establishing gestational weight gain recommendations by pre-pregnancy BMI category and calorie guidance by trimester. The basis for the platform's calorie guidance: no additional calories in T1, +340 kcal in T2, +450 kcal in T3, +500 kcal during breastfeeding."
                url="https://www.nationalacademies.org/our-work/weight-gain-during-pregnancy-reexamining-the-guidelines"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Symptom-Responsive Ingredient Adjustments</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Nausea → ginger/B6/bland/cool foods · Heartburn → avoid acidic/spicy/fried · Swelling → reduce sodium/increase potassium · Fatigue → iron + vitamin C pairing · Constipation → prunes/chia/oats/water
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="ACOG — Nausea and Vomiting of Pregnancy (Practice Bulletin No. 189, 2018)"
                description="ACOG clinical guidance establishing ginger, vitamin B6, and small frequent bland meals as first-line dietary interventions for nausea in pregnancy. The basis for the nausea symptom adjustments in every meal generator."
                url="https://www.acog.org/clinical/clinical-guidance/practice-bulletin/articles/2018/01/nausea-and-vomiting-of-pregnancy"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Caffeine Limits</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Beverage Creator caffeine guidance · Coach escalation on high-caffeine requests
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="ACOG Committee Opinion No. 462 — Moderate Caffeine Consumption During Pregnancy (2010, reaffirmed 2020)"
                description="ACOG recommendation limiting caffeine to less than 200mg/day during pregnancy, citing increased risk of growth restriction and pregnancy loss at higher intakes. The basis for the platform's caffeine guidance in pregnancy coaching and beverage recommendations."
                url="https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2010/08/moderate-caffeine-consumption-during-pregnancy"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Postpartum &amp; Breastfeeding Nutrition</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Postpartum protocol (fiber, omega-3, protein, iodine/DHA in breastmilk) · Alcohol block during breastfeeding · Extreme diet block postpartum
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="AAP — Breastfeeding and the Use of Human Milk (Pediatrics, 2012, PMID 22371471)"
                description="American Academy of Pediatrics policy statement recommending exclusive breastfeeding for 6 months. The basis for the alcohol hard-block during breastfeeding (alcohol passes directly into breast milk) and the high-mercury fish block (methylmercury passes into breast milk)."
                url="https://pubmed.ncbi.nlm.nih.gov/22371471/"
              />
              <SourceItem
                title="WHO — Infant and Young Child Feeding"
                description="World Health Organization complementary feeding and breastfeeding guidance. Supports the +500 kcal calorie guidance for breastfeeding and iodine/DHA priority during lactation."
                url="https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding"
              />
            </ul>

            <p className="text-white/60 text-xs leading-relaxed">
              Pregnancy Coach provides nutritional guidance only. It does not replace your OB/GYN, midwife, or registered dietitian's prenatal care. When a question requires clinical judgment, Pregnancy Coach says so directly and does not speculate.
            </p>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              👶 Parent's Corner — Evidence &amp; Guidance Sources
            </h3>
            <p className="text-white/60 text-xs mb-3">
              Parent's Corner is the conversational coaching interface for My Perfect Beginning.
              The selected child is the nutrition subject — every response is grounded in that
              child's developmental stage, allergen profile, medical conditions, and feeding
              context. The following sources are the pediatric and clinical basis for the
              guidance the system provides. Each citation identifies what it specifically
              supports in the coaching system.
            </p>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Age-Appropriate Food Introduction &amp; Texture Progression</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Stage-matched food generation · texture calibration by developmental stage · first foods guidance for early infant and beginning foods stages
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="AAP — Starting Solid Foods (HealthyChildren.org)"
                description="American Academy of Pediatrics guidance on when and how to introduce solid foods, including signs of readiness (typically around 6 months), appropriate first foods (single-ingredient purees), texture progression (purees → mashed → soft pieces → family foods), and foods to avoid in the first year (honey, cow's milk as main drink, choking hazards). This is the primary framework for stage-matched meal generation."
                url="https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Starting-Solid-Foods.aspx"
              />
              <SourceItem
                title="WHO — Complementary Feeding: Family Foods for Breastfed Children"
                description="World Health Organization guidance on complementary feeding introduction after 6 months, nutrient-dense first foods, texture progression, and responsive feeding principles. Supports the platform's stage-aware meal generation and the feeding behavior context captured in each child's profile."
                url="https://www.who.int/publications/i/item/complementary-feeding-family-foods-for-breastfed-children"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Allergen Introduction</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Allergen profile enforcement in child meal generation · early allergen introduction guidance in Parent's Corner coaching
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="NIAID — Addendum Guidelines for Prevention of Peanut Allergy in the United States (Journal of Allergy and Clinical Immunology, 2017, PMID 28065278)"
                description="National Institute of Allergy and Infectious Diseases clinical guidelines establishing early peanut introduction (4–6 months for high-risk infants with eczema or egg allergy) as protective against peanut allergy. The basis for the platform's early allergen introduction guidance in Parent's Corner and the allergen profile structure in child nutrition profiles."
                url="https://pubmed.ncbi.nlm.nih.gov/28065278/"
              />
              <SourceItem
                title="AAP — Preventing Allergies in Babies and Young Children (2019)"
                description="Updated AAP guidance recommending early introduction of allergenic foods (peanut, egg, tree nuts, fish) for most infants, rather than avoidance. The platform's allergen coaching reflects this evidence-based shift away from delayed-introduction approaches."
                url="https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Food-Allergies-in-Children.aspx"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Choking Safety &amp; Texture</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Texture calibration by stage · choking-risk ingredient avoidance for infant and toddler stages
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="AAP — Choking Prevention (HealthyChildren.org)"
                description="American Academy of Pediatrics guidance identifying high-choking-risk foods for children under 4: whole grapes, raw carrots, chunks of meat, hot dogs, hard candies, nuts, popcorn, and raw apple pieces. These categories are blocked or flagged in child meal generation for infant and young toddler stages."
                url="https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/Choking-Prevention.aspx"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Division of Responsibility in Feeding</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Picky eating guidance · feeding behavior coaching language · non-coercive approach to food refusal
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="Satter, E. — Child of Mine: Feeding with Love and Good Sense (2000); Ellyn Satter Institute — Division of Responsibility in Feeding"
                description="Ellyn Satter's Division of Responsibility (sDOR) framework: parents/caregivers decide what food is offered, when, and where; children decide whether to eat and how much. This framework is the basis for the platform's picky eating coaching language — it avoids coercive or pressure-based feeding advice and reinforces the parent's role without overriding the child's autonomy at the table."
                url="https://www.ellynsatterinstitute.org/how-to-feed/the-division-of-responsibility-in-feeding/"
              />
            </ul>

            <p className="text-white/50 text-xs font-semibold uppercase tracking-wide mb-2">Child Growth &amp; Developmental Nutrition</p>
            <p className="text-white/40 text-xs mb-2">
              Drives: Stage-appropriate calorie and nutrient calibration · growth-stage meal planning · developmental milestone-aware guidance
            </p>
            <ul className="space-y-3 mb-5">
              <SourceItem
                title="WHO Child Growth Standards (2006)"
                description="World Health Organization international reference standards for child growth from birth to 5 years — weight, height, and developmental benchmarks used as the basis for age- and stage-appropriate nutritional calibration in the platform."
                url="https://www.who.int/tools/child-growth-standards"
              />
              <SourceItem
                title="USDA MyPlate — Kids & Toddlers (Dietary Guidelines for Americans, 2020–2025)"
                description="USDA evidence-based food group and portion guidance for children aged 1–13. The basis for age-appropriate portion calibration, food variety goals, and the nutrient priorities for toddler, preschool, and early school-age stages in the platform."
                url="https://www.myplate.gov/life-stages/kids"
              />
              <SourceItem
                title="AAP — Pediatric Nutrition (7th ed., Kleinman & Greer, eds., 2014)"
                description="The AAP's comprehensive clinical reference for pediatric nutrition — macronutrient and micronutrient requirements by age, common nutritional deficiencies, feeding behavior clinical context, and growth monitoring. The foundational clinical reference for the pediatric nutrition protocols used in child meal generation."
                url="https://shop.aap.org/pediatric-nutrition-7th-edition/"
              />
            </ul>

            <p className="text-white/60 text-xs leading-relaxed">
              Parent's Corner provides nutritional guidance grounded in the selected child's profile — not individualized medical advice. When a question requires a pediatrician or registered dietitian — growth concerns, diagnostic questions, or medical treatment decisions — Parent's Corner says so directly and does not speculate.
            </p>
          </section>

          <HydrationEvidenceSection active={open} />

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
              oncology, physician, or registered dietitian guidance. Pregnancy
              Coach guidance is for general nutrition education only and is
              not a substitute for your OB/GYN, midwife, or registered
              dietitian's prenatal care. Parent's Corner guidance is for
              general child nutrition education only and is not a substitute
              for your pediatrician or registered dietitian's guidance. Always
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

interface HydrationEvidenceRecord {
  key: string;
  title: string;
  organizationOrAuthor: string;
  publicationDate: string;
  url: string;
  citation: string;
  evidenceTier: string;
  evidenceLevel: string;
  populationScope: string;
  ruleSupported: string;
}

function HydrationEvidenceSection({ active }: { active: boolean }) {
  const [records, setRecords] = useState<HydrationEvidenceRecord[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV || !active || records.length > 0 || failed) return;
    apiRequest<{ sources: HydrationEvidenceRecord[] }>("/api/hydration/evidence")
      .then((result) => setRecords(result.sources))
      .catch(() => setFailed(true));
  }, [active, failed, records.length]);

  if (!import.meta.env.DEV) return null;

  return (
    <section
      id="hydration-evidence"
      className="rounded-2xl border border-sky-400/20 bg-sky-950/25 p-4"
    >
      <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
        <Droplets className="h-5 w-5 text-sky-300" />
        Hydration evidence registry
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-white/60">
        These sources support the clinician-defined numeric policy and its
        no-number safety boundaries. Population total-water values are
        educational references, not individualized logged-water targets.
      </p>
      {failed ? (
        <p className="mt-4 text-sm text-amber-300">
          The Hydration evidence registry is temporarily unavailable.
        </p>
      ) : records.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">Loading 32 sources…</p>
      ) : (
        <div className="mt-4 space-y-2">
          {records.map((record) => (
            <details
              key={record.key}
              className="group rounded-xl border border-white/10 bg-black/20"
            >
              <summary className="cursor-pointer list-none px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {record.title}
                    </p>
                    <p className="mt-1 text-[11px] text-white/40">
                      {record.organizationOrAuthor} · {record.publicationDate} ·{" "}
                      {record.evidenceTier.replaceAll("_", " ")}
                    </p>
                  </div>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                </div>
              </summary>
              <div className="space-y-2 border-t border-white/8 px-3 py-3 text-xs leading-relaxed">
                <p className="text-white/65">{record.ruleSupported}</p>
                <p className="text-white/45">
                  Scope: {record.populationScope}
                </p>
                <a
                  href={record.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                >
                  Open source
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
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
