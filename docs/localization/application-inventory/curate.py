"""Assemble source-reviewed evidence into a static report, not a coverage gate."""
import csv
import hashlib
import html
import json
from collections import Counter
from pathlib import Path

OUT = Path("docs/localization/application-inventory")
read = lambda name: list(csv.DictReader((OUT / (name + ".csv")).open()))
owners = {r["owner"]: r for r in read("text-owner-register")}
keys = read("translation-connections")
routes = read("route-register")
summary = json.loads((OUT / "discovery-summary.json").read_text())

# Records are owner-level review units, not one defect for every string or caller.
# Source anchors are asserted to exist before any output is delivered.
definitions = [
 ("L01","client/src/i18n/index.ts","consumerJourney: consumerEnglish","connected","All roles","startup / language change","shared-foundation","Registered legacy resources plus additive EN/ES resources; fallback is English. Registration does not translate hardcoded JSX.","architecture"),
 ("L02","client/src/components/ui/button.tsx","translateSharedLabel(children, t)","connected","All roles","standard direct-child button action","shared-foundation","Button applies the bounded shared action helper only when asChild is false. Nested markup, titles and aria props are not recursively translated.","common.save"),
 ("L03","client/src/components/ui/pill-button.tsx","{children}","caller-content","All roles","pill actions in cards, narration and menus","shared-foundation","PillButton renders children unchanged. It owns no general prose; translate caller-owned labels explicitly. Do not broaden the wrapper to arbitrary text.","none"),
 ("L04","client/src/components/ui/dialog.tsx",'t("common.close")',"connected","All roles","open modal / accessible close","shared-foundation","DialogContent owns only its built-in close label; caller children/title/body remain caller-owned.","common.close"),
 ("L05","client/src/components/ui/sheet.tsx",'t("common.close")',"connected","All roles","open sheet / accessible close","shared-foundation","SheetContent owns its built-in close label; it does not translate arbitrary sheet content.","common.close"),
 ("L06","client/src/components/ui/toast.tsx","translateSharedLabel(children, t)","connected","All roles","notification action/title/description and close","shared-foundation","ToastAction/Title/Description recognize only bounded standard labels; producers own unique messages. ToastClose has its own localized accessible label.","common.close"),
 ("L07","client/src/components/ui/form.tsx","translateBasicValidation","connected","All roles","validation error","shared-foundation","FormMessage maps Required/Invalid email and approved consumer phrases; unknown server/schema messages pass through. This is not general validation translation.","localeFoundation.required"),
 ("L08","client/src/components/ui/tooltip.tsx","{...props}","caller-content","All roles","hover/focus tooltip","shared-foundation","TooltipContent forwards props without translating content. Dropdown/context menus follow the same ownership principle; audit each caller, not the primitive once per page.","none"),
 ("L09","client/src/components/NarrationBar.tsx","controlLabels?.[text] ?? text","hardcoded-path","Consumer / professional","listen / pause / resume / transcript","shared-foundation","Controls default to English. ConsumerWelcome supplies translated controlLabels; ProCareWelcome passes only sections and speedOverride. Sections/headings/transcripts belong to callers; do not rewrite them in the primitive.","none"),
 ("L10","client/src/lib/mealGenerationProgress.ts","Chef is crafting your meal options","hardcoded-path","Food consumers / professionals","generation loading / rotating status","shared-food","getMealGenerationCopy owns titles/messages; useMealGenerationProgress passes them unchanged to MealGenerationProgress role=status. One shared owner, not one fix per builder.","none"),
 ("L11","client/src/components/UniversalMealCardFooter.tsx","Logged Successfully","hardcoded-path","Meal card consumers","log success / missing nutrition / log failure","shared-food","Toast producers use English literals; the shared toast helper cannot translate these unique phrases. Calculations and serving values are outside this inventory.","none"),
 ("L12","client/src/components/BuilderShoppingBar.tsx","No meals found","hardcoded-path","Builder consumers / professional client boards","empty board / shopping feedback","shared-food","Unique empty-board notification belongs to BuilderShoppingBar, not every consuming builder. Existing key connections elsewhere do not translate this title.","none"),
 ("L13","client/src/components/Router.tsx","Almost there!","hardcoded-path","Paid consumer / professional / demo roles","onboarding redirect toast / suspense / secure workspace loading","shared-foundation","The guard creates English toasts and loading branches. AppRouter's localized common.loading does not cover Router's separate suspense/development Studio branches.","none"),
 ("L14","client/src/pages/ConsumerWelcome.tsx",'t("MEDICAL DISCLAIMER")',"approved-protected-connected","First-run consumer","32 approved sections / both required checkboxes / narration","preserve-approved","All approved EN/ES explanation/disclaimer pairs are centrally connected. Existing fixture browser evidence verifies Spanish desktop/mobile and both independent checkbox requirements; no new consent approval is inferred.","MEDICAL DISCLAIMER"),
 ("L15","client/src/pages/Auth.tsx","Your session has expired.","connected","Anonymous / invitation / privileged MFA","signup / login / expired session / mapped errors","preserve-approved","Approved source-key consumer copy is connected; Phase 2 browser evidence covers public forms, not real signup, invitation acceptance or MFA issuance.","Your session has expired. Please sign in again to continue."),
 ("L16","client/src/pages/OnboardingV3.tsx","Any relevant medical conditions?","protected","First-run consumer","medical-condition selections / recommended builder","protected-review","Medical heading is literal JSX and MEDICAL_CONDITIONS options render item.label directly, with a Development GLP-1 override. These are not translated by PillButton. Policy explanations need protected review; do not change option IDs or condition matching.","none"),
 ("L17","client/src/pages/DashboardNew.tsx","InspirationCaptureModal","mixed","Consumer","dashboard cards / Recipe Maker launch / gated menus","consumer-features","Selected dashboard/navigation copy is connected by Phase 2. Recipe Maker is a modal launched here, not a separately registered RecipeMaker route. Its states and unique wording have their own owner.","none"),
 ("L18","client/src/components/InspirationCaptureModal.tsx","inspiration.tryMoreNoContentTitle","missing-fallback","Consumer","Recipe Maker / Try More with no usable input","consumer-features","No EN/ES resource at the referenced keys. Explicit English default strings are shown by this guarded toast path; no blank-input request is sent. Do not confuse this with general Recipe Maker key coverage.","inspiration.tryMoreNoContentTitle"),
 ("L19","client/src/pages/lifestyle/CreateDishPage.tsx","Nutrition per serving","hardcoded-path","Consumer","expanded generated card / alternatives / cooking-method selection","consumer-features","Plain JSX owns this label; other labels/configuration such as cooking methods and generated alternatives are also owner-specific candidates. Generated dish names/instructions are different data, not UI literals.","none"),
 ("L20","client/src/pages/craving-creator.tsx","Describe Your Craving","candidate","Consumer","help steps / restored result / save feedback","consumer-features","English tour configuration exists; automatic education is gated/off on some paths, so do not treat every tour entry as currently displayed. Verify the actual help trigger before extracting.","none"),
 ("L21","client/src/pages/CravingDessertCreator.tsx","Surprise Me!","candidate","Consumer","dessert categories / servings / generation / restoration","consumer-features","Category configuration is source-discovered; preserve canonical values and verify display mapping. Dessert and smaller Craving meals are separate products, not interchangeable ownership.","none"),
 ("L22","client/src/pages/pro/GeneralNutritionBuilder.tsx","Loading meal board...","hardcoded-path","Consumer / trainer / physician client context","board loading / empty log / success / schedule","builders","The direct loading return renders English before the board. Shared picker/card/progress strings stay with their shared owners; clinical schedule text requires separate review.","none"),
 ("L23","client/src/components/OncologySymptomDialog.tsx","Cancer Support — select all that apply","protected","Eligible clinical consumer / professional","symptom dialog / read-only / error / review summary","protected-review","FormModal receives literal title/description; Done is a native button literal. Selector owns symptom options; caller owns saveHint and error. No clinical wording or activation is changed.","none"),
 ("L24","client/src/components/OncologySymptomSelector.tsx","None currently","protected","Eligible clinical consumer / professional","symptom checkbox legend / none / error","protected-review","Legend/options and verification errors are clinical text; shared oncology selection constants supply further labels. Preserve source IDs and clinical meaning.","none"),
 ("L25","client/src/components/pro/ClinicalAdvisoryDrawer.tsx","Clinical Advisory","protected","Authorized professional","advisory drawer / condition explanations","protected-review","Drawer includes clinical labels/descriptions and protected advisory prose. Role and client authorization remain mandatory; no runtime entitlement is inferred from imports.","none"),
 ("L26","client/src/pages/MacroCalculator.tsx","Healthy guideline: your waist","protected","Consumer / professional workflow","waist explanation / help / result / validation","protected-review","Visible clinical explanatory JSX is not covered by translating ordinary calculator labels. Numeric parsing, measurements and target calculations belong to the separate measurement audit.","none"),
 ("L27","client/src/components/shopping/GroceryStoreCoachSheet.tsx","Add All to Shopping List","hardcoded-path","Paid consumer / permitted food workflow","result / add success / swap error / empty / packaged product gate","shopping","Native button uses literal Add All to Shopping List / Added to List!. Server error details and generated meal reasoning are separate owners. Product discovery is Development-gated; do not count hidden states as observed.","none"),
 ("L28","client/src/components/shopping/GroceryStoreCoachSheet.tsx","smartCart.brandsSummary","connected-plural","Paid consumer","picked brands count > 0","shopping","Base key has no direct value, but both EN/ES one/other plural variants exist. Not a missing-key defect. This key connection does not translate the neighboring hardcoded buttons.","smartCart.brandsSummary"),
 ("L29","client/src/pages/ShoppingListMasterView.tsx","No items to send","hardcoded-path","Paid consumer","empty send / scan lookup failure / clipboard feedback","shopping","English toast is produced by the shopping owner. Saved item names, barcode/brand evidence and generated list contents remain data. Both shopping route aliases share this owner.","none"),
 ("L30","client/src/components/shopping/BarcodeScanButton.tsx","Position the barcode in the camera view","hardcoded-path","Shopping consumer","scanner modal / camera instruction / manual entry","shopping","Plain JSX scanner instruction renders in the opened modal. Camera permission and native/browser behavior were not exercised; barcode values and camera capability errors are not guessed translations.","none"),
 ("L31","client/src/components/away-from-home/RestaurantCuisineFeedback.tsx","restaurant.historicalCuisineResults","missing-fallback","Eligible restaurant user","historical/restored results / regenerate prompt","consumer-features","Absent EN/ES keys with explicit English defaultValue bodies; source status rendering confirms fallback path. cuisineNotice/compositionNotice may be server-owned, not this component's prose.","restaurant.historicalCuisineResults"),
 ("L32","client/src/pages/profile/LanguagePreferencesPage.tsx","Auto (Device)","hardcoded-path","Signed-in consumer / professional","language option / description / save rollback","consumer-features","The LANGUAGES display configuration includes English Auto label/description. Native-language autonyms and deliberate example-language descriptions are not all defects. Preserve Auto intent and save behavior.","none"),
 ("L33","client/src/components/pro/StudioVideoMessageComposer.tsx","Review the complete recording before sending.","hardcoded-path","Authorized Studio participants","record / review / discard / send / permission/error","professional","Review instruction is direct JSX. Participant name and message recording are authored content; do not translate them. Permission, media upload and send flows were not run.","none"),
 ("L34","client/src/pages/pro/ProClients.tsx","clients.archiveTitle","missing-fallback","Authorized trainer / Studio user","archive confirmation / non-synthetic client","professional","pro:clients.archiveTitle and archiveBody are absent while archiveSubtitle exists. Source calls have no defaultValue, so the key can be displayed. Confirmation is gated by !syntheticSource && archivePendingClient; no archive operation was run.","clients.archiveTitle"),
 ("L35","client/src/pages/BusinessDashboard.tsx","Could not send invitation.","hardcoded-path","Authorized organization administrator","invite failure / policy success / organization switch / roles","business","English fallback error title/body and role configuration belong here; API err.message details are a separate server contract. No invitation was sent and no organization was switched.","none"),
 ("L36","client/src/layout/BusinessDesktopLayout.tsx",'label: "Organizations"',"hardcoded-path","Business workspace member","desktop navigation / active section / exit","business","BUSINESS_NAV labels are mapped directly into links. Header and each destination's content have distinct owners. Business shell is outside ordinary AppLayout route closure.","none"),
 ("L37","client/src/layout/BusinessMobileLayout.tsx",'aria-label="Switch organization workspace"',"hardcoded-path","Business workspace member","mobile nav / organization switch / accessible names","business","Mobile has its own shortened label configuration and accessible names, not a simple copy of desktop. Source branch selected by BusinessWorkspaceLayout; installed mobile behavior not observed.","none"),
 ("L38","client/src/pages/JoinStudio.tsx","joinStudio.anotherAddress","missing-english-value","Invited existing/new account","email mismatch and absent maskedEmail","professional","Spanish has otra dirección; English lacks this key. This is an English fallback/raw-key risk, not a missing Spanish translation. Only the conditional masked-address fallback is implicated. Preserve invitation identity and legal payloads.","joinStudio.anotherAddress"),
 ("L39","client/src/pages/TermsOfService.tsx","Terms of Service</h1>","protected","Public / signing consumer","terms document / consent links","protected-review","Legal document source is a protected wording owner, not permission to machine-translate contractual terms. Privacy, deletion and professional attestation are parallel protected queues.","none"),
 ("L40","client/src/pages/Learn.tsx","Medical conditions like diabetes were rarely considered","protected","Consumer / learner / professional","education content / clinical terminology","protected-review","Education source contains clinical prose. Existing clinical source registry reports inherited integrity failures involving Learn/Academy/Edit Profile. Configuration discovery is not proof all educational states are active; do not repair registry/manifests here.","none"),
 ("L41","client/src/hooks/useTranslatedMeal.ts","meal-translation","authored-data","Meal consumers","saved-meal translation / cache / fallback","data-contract","Saved/generated meal text uses an explicit translation layer, not interface-key substitution. Source fallback can preserve original language; no paid translation request, cache behavior or historical record was changed.","none"),
 ("L42","client/src/components/WhatsNewCard.tsx","{release.headline}","historical-data","Consumer","authored release-note body / dismissal controls","data-contract","Phase 2 localized Got it, not delivered historical release-note prose. Headline/bullets come from config/whatsNew; preserve historical bodies and release identity. The separate aria-label Dismiss remains caller-owned UI, not historical content.","none"),
 ("L43","server/routes/groceryCoach.ts","Clinical guidance temporarily unavailable.","server-message","Grocery Coach customer","clinical context unavailable / generation or swap rejection","server-contract","Server returns English error JSON; GroceryStoreCoachSheet throws data.error and surfaces err.message. Exact error contract needs server ownership and clinical review, not a client prose wrapper.","none"),
 ("L44","server/services/ingredientScanService.ts","We couldn't clearly read this image.","server-message-protected","Product scanner customer","unreadable image / fallback verdict / educational footer","server-contract","LOW_CONFIDENCE_RESULT supplies English copy and a medical disclaimer. IngredientIntelligenceSheet consumes the result; protect safety meanings and source evidence. Model-language instructions cannot translate deterministic fallbacks.","none"),
 ("L45","server/services/bugReportAcknowledgement.ts","Thank you for contacting My Perfect Meals.","delivery-template","Support reporter","report received acknowledgement email","server-contract","English delivered email template is separate from UI success feedback. Preserve report identifiers and escaping. Source renderer reviewed only; no queue row, delivery or email was generated.","none"),
 ("L46","server/services/pushNotificationService.ts","Time for ${label} at ${time}.","delivery-template","Opted-in notification recipient","scheduled meal reminder push","server-contract","Push body is server-owned template prose; meal label/time interpolation are separate values. Transport payload forwarding does not imply UI localization or delivered-language verification.","none"),
 ("L47","client/src/components/MealGenerationProgress.tsx","@media (prefers-reduced-motion: reduce)","technical-non-target","All food roles","CSS reduced-motion style block","exclude","Scanner captures the style JSX expression; it is CSS, not customer-visible English. Exclude from translation workload rather than padding dictionaries.","none"),
 ("L48","client/src/pages/procare/ProCareTraining.tsx","procare.training.stepOf","gated-unverified","Legacy professional training","unregistered legacy training page","exclude","Source contains a missing key, but /procare-training routes to LegacyProCareTrainingRedirect, not this file. Do not count it as a verified current screen defect.","procare.training.stepOf"),
 ("L49","client/src/pages/lifestyle/ChefsKitchenPage.tsx",'t("servingsLabel")',"missing-fallback","Eligible consumer","Chef's Kitchen servings / create-new control","consumer-features","chefsKitchen namespace lacks these keys although other namespaces contain similarly named keys. Key presence elsewhere does not connect this caller; this page's role/feature gate was not exercised.","servingsLabel"),
 ("L50","client/src/components/MealReminders.tsx","mealReminders.iosScheduleConfirmed","connected-plural","Installed iOS reminder user","native schedule success acknowledgement","preserve-approved","The base key is absent but EN/ES one/other variants exist (Spanish also has many). Not a missing translation. Native delivery and actual device rendering remain unverified; no notification permission or schedule was changed.","mealReminders.iosScheduleConfirmed"),
 ("L51","client/src/pages/HydrationCenter.tsx","Could not log fluid","hardcoded-path","Eligible consumer / clinical user","fluid log error / setup / empty history / help","consumer-features","Notification title is English literal; clinical target explanations are a separate protected subqueue. Hydration units/targets remain outside translation implementation.","none"),
 ("L52","client/src/components/pro/ProfessionalLegalModal.tsx","Please review and accept each document to continue.","protected","Professional / client legal party","agreement acceptance / current attestation","protected-review","ProfessionalLegalModal renders coach/physician agreements from client/legal plus shared/legalDocuments; ClientLegalModal separately selects client/patient agreements. Preserve document versions, consent and role restrictions. No acceptance path was exercised.","none"),
 ("L53","client/src/components/ui/universal-modal.tsx","<DialogTitle>{title}</DialogTitle>","caller-content","All roles","confirmation / form / picker / workflow / wizard modal","shared-foundation","Universal modal variants render supplied title, description, footer and children without translating them. Caller-provided title/body are separate text owners from dialog close or a shared standard action.","none"),
 ("L54","client/src/components/ui/dropdown-menu.tsx","DropdownMenuItem","caller-content","All roles","open dropdown / nested submenu / keyboard action","shared-foundation","Menu primitives forward item props/content. Each navigation/configuration caller owns item labels and tooltips; do not count this container as another untranslated page.","none"),
]

records = []
for ident, file, anchor, category, role, state, batch, evidence, key in definitions:
    source = Path(file).read_text()
    assert anchor in source, (ident, file, anchor)
    offset = source.index(anchor)
    number = source[:offset].count("\n") + 1
    lines = source.splitlines()
    matching = [k for k in keys if k["owner"] == file and k["key"] == key]
    connection = matching[0] if matching else None
    info = owners.get(file, {})
    route_refs = json.loads(info.get("routes", "[]"))
    callers = json.loads(info.get("directCallers", "[]"))
    if file.startswith("server/"):
        # Explicitly inspected cross-layer consumer, not automatic server reachability.
        route_refs = {
            "L43": ["/shopping-list-v2 (Grocery Coach sheet)"],
            "L44": ["Ingredient Intelligence scanner callers; exact endpoint mount not runtime verified"],
            "L45": ["Support report submission -> durable acknowledgement"],
            "L46": ["Meal-reminder scheduling -> opted-in push recipient"],
        }.get(ident, [])
    if not route_refs:
        route_refs = ["Global/shared/configuration or gated/unresolved: see evidence; no live activation inferred"]
    record = dict(id=ident, classification=category, owner=file, source=f"{file}:{number}",
                  sourceSha256=hashlib.sha256(source.encode()).hexdigest(),
                  excerpt="\n".join(f"{i+1}: {lines[i]}" for i in range(max(0, number-2), min(len(lines), number+2))),
                  roles=role, stateTrigger=state,
                  device="Both source layouts unless explicitly desktop/mobile/native; runtime unverified",
                  routes=route_refs, sharedCallers=callers,
                  textOwnership="Shared owner; unique caller content remains with caller" if batch.startswith("shared") else "Feature owner; imported shared controls/data retain separate owners",
                  namespace=connection["namespace"] if connection else (
                      "translation" if key.startswith("common.") or key.startswith("localeFoundation.") else "none / not applicable"),
                  key=key if key not in ("none","architecture") else None,
                  english=connection["en"] if connection and connection["en"] else None,
                  spanish=connection["es"] if connection and connection["es"] else None,
                  defaultValue=connection["defaultValue"] if connection else None,
                  pluralForms=json.loads(connection["pluralForms"]) if connection and connection["pluralForms"] else None,
                  dictionaryAvailability=connection["status"] if connection else
                    "No translation connection claimed here; see source ownership and evidence",
                  visibilityEvidence=evidence,
                  evidenceLevel="Source trace only; not a newly observed customer session",
                  protectedReview=category in ("protected","approved-protected-connected","server-message-protected") or ident in ("L16","L43"),
                  uncertainty="Conditions, entitlements and real data were not exercised. Imported callers are potential, not proven active.",
                  proposedBatch=batch)
    # Shared helpers call dynamically, so their reviewed samples come from JSON.
    if key.startswith("common.") or key.startswith("localeFoundation."):
        for lang, prop in [("en","english"),("es","spanish")]:
            value=json.loads(Path(f"client/src/i18n/locales/{lang}.json").read_text())
            for segment in key.split("."): value=value[segment]
            record[prop]=value
        record["dictionaryAvailability"]="EN/ES sample values present; bounded helper, not general prose translation"
    if ident=="L14":
        record["evidenceLevel"]="Current source plus reused fixture-browser record; audio/persistence not tested"
    records.append(record)

def write_csv(name, rows):
    columns = list(dict.fromkeys(k for r in rows for k in r))
    with (OUT / (name+".csv")).open("w", newline="") as f:
        writer=csv.DictWriter(f,fieldnames=columns)
        writer.writeheader()
        for r in rows:
            writer.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items()})

(OUT/"reviewed-findings.json").write_text(json.dumps(records,ensure_ascii=False,indent=2)+"\n")
if Path(__file__).resolve() != (OUT/"curate.py").resolve():
    (OUT/"curate.py").write_text(Path(__file__).read_text())
write_csv("reviewed-findings",records)
write_csv("missing-key-triage",[dict(r,review="Source lookup only; check caller gate, defaultValue and role before treating as visible defect") for r in keys if r["status"]=="missing-or-fallback-candidate"])
write_csv("feature-state-review",json.loads((OUT/"feature-state-review.json").read_text()))
print("Curated",len(records),"owner-level review records;",dict(Counter(r["classification"] for r in records)))

if __name__ == "__main__":
    # Rendering is separate so a source-assertion failure never produces a
    # plausibly complete founder report.
    narrative = (OUT/"inventory.md").read_text() if (OUT/"inventory.md").exists() else ""
    if not narrative:
        print("Write inventory.md and rerun to assemble the static HTML.")
    else:
        e=lambda v:html.escape(str(v))
        def table(headers, rows):
            return "<div class='scroll'><table><thead><tr>"+"".join("<th>"+e(h)+"</th>" for h in headers)+"</tr></thead><tbody>"+"".join("<tr>"+"".join("<td>"+e(c)+"</td>" for c in row)+"</tr>" for row in rows)+"</tbody></table></div>"
        # No external CSS, JS, fonts, images, APIs or embedded app.
        body="<header><p class='eyebrow'>MY PERFECT MEALS · READ-ONLY DEVELOPMENT REVIEW</p><h1>Application localization inventory</h1><p>Evidence, shared ownership, protected wording and next-scope proposals. No translations or application behavior changed.</p></header>"
        body+="<nav><a href='#decision'>Decision & limits</a><a href='#matrix'>Feature/state matrix</a><a href='#findings'>Reviewed findings</a><a href='#missing'>Fallback triage</a><a href='#routes'>Route register</a></nav>"
        # Small escaped Markdown subset: no executable markup or remote assets.
        def render_narrative(text):
            lines=text.splitlines()
            output=[]
            index=0
            while index < len(lines):
                value=lines[index]
                if value.startswith("|") and index+1<len(lines) and lines[index+1].startswith("|---"):
                    headers=[c.strip() for c in value.strip("|").split("|")]
                    index+=2
                    data=[]
                    while index<len(lines) and lines[index].startswith("|"):
                        data.append([c.strip() for c in lines[index].strip("|").split("|")])
                        index+=1
                    output.append(table(headers,data))
                    continue
                if value.startswith("#"):
                    level=min(4,len(value)-len(value.lstrip("#")))
                    output.append(f"<h{level}>{e(value.lstrip('#').strip())}</h{level}>")
                elif value.startswith("- "):
                    output.append("<p class='bullet'>• "+e(value[2:])+"</p>")
                elif value:
                    output.append("<p>"+e(value)+"</p>")
                index+=1
            return "".join(output)
        body+="<section id='decision'><h2>Decision, method and implementation proposals</h2><div class='narrative'>"+render_narrative(narrative)+"</div></section>"
        matrix=read("feature-state-review") if (OUT/"feature-state-review.csv").exists() else []
        body+="<section id='matrix'><h2>Feature/state review matrix</h2><p>State labels describe inspected source or earlier fixture evidence, not an exhaustive set of accessible runtime states. Complete route-level discovery is appended below and in route-state-matrix.csv.</p>"
        body+=table(["Feature / role","Routes / entry","States and variants","Evidence / limits","Findings"],[[r.get(k,"") for k in ["featureRole","routesEntry","statesVariants","evidenceLimits","findings"]] for r in matrix])+"</section>"
        body+="<section id='findings'><h2>Deduplicated reviewed findings</h2><p>"+str(len(records))+" owner-level records include positive connections, non-targets and unknowns. This is not a count of defects. Repeated consumers do not multiply a shared-owner fix.</p>"
        for r in records:
            body+=f"<article id='{r['id']}'><h3>{e(r['id'])} · {e(r['classification'])}</h3><p><strong>{e(r['source'])}</strong></p><p>{e(r['roles'])} · {e(r['stateTrigger'])} · {e(r['device'])}</p><p>{e(r['visibilityEvidence'])}</p><pre>{e(r['excerpt'])}</pre>"
            body+=f"<p><strong>Translation:</strong> {e(r['namespace'])} / {e(r['key'])}; {e(r['dictionaryAvailability'])}<br>EN: {e(r['english'])}<br>ES: {e(r['spanish'])}<br>English default: {e(r['defaultValue'])}</p>"
            if r["pluralForms"]: body+="<pre>"+e(json.dumps(r["pluralForms"],ensure_ascii=False,indent=2))+"</pre>"
            body+=f"<p><strong>Visibility:</strong> {e(r['evidenceLevel'])}<br><strong>Review batch:</strong> {e(r['proposedBatch'])}<br><strong>Protected review:</strong> {e(r['protectedReview'])}<br><strong>Uncertainty:</strong> {e(r['uncertainty'])}</p>"
            body+="<details><summary>Known routes and direct source callers</summary><p>Potential import reachability only. Global shell ownership is separate.</p><pre>"+e("\n".join(r["routes"]))+"</pre><pre>"+e("\n".join(r["sharedCallers"]) or "No direct client importer proven by this graph; inspect cross-layer/global mount.")+"</pre></details></article>"
        body+="</section><section id='missing'><h2>Missing or fallback-key triage</h2><p>These 20 calls lack a directly resolved value in at least one of EN/ES, after the four plural-call exclusions. JoinStudio has Spanish but lacks English. Some calls are unregistered or otherwise gated. This is not 20 confirmed customer defects.</p>"
        missing=read("missing-key-triage")
        body+=table(["Owner / line","Namespace / key","Default","State context"],[[f"{r['owner']}:{r['line']}",f"{r['namespace']}:{r['key']}",r["defaultValue"] or "none; raw-key risk",r["context"]] for r in missing])+"</section>"
        body+="<section id='routes'><h2>All discovered route registrations</h2><p>248 AST registrations; 247 distinct literal paths plus one pathless fallback. Redirect-only and unresolved registrations remain explicit; no authorization or production activation is inferred.</p>"
        body+=table(["Source","Path","Component / expression","Potential root owners","Outer gate evidence"],[[r[k] for k in ["registration","route","component","owners","gateEvidence"]] for r in routes])+"</section>"
        body+="<footer>Review-only output. Stop for founder scope approval. No deployment, merge, data mutation, provider call or dictionary change.</footer>"
        document="<!doctype html><html lang='en'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>My Perfect Meals — localization coverage inventory</title><style>body{margin:0;background:#f4f5f7;color:#17212b;font:15px/1.55 system-ui,sans-serif}header{padding:44px max(24px,calc((100vw - 1280px)/2));background:#162a3a;color:white}h1{font-size:36px;line-height:1.15;max-width:900px}h2{font-size:25px}h3{font-size:18px;color:#155e63}.eyebrow{font-size:12px;letter-spacing:.13em;color:#a9d9d7}nav{display:flex;gap:20px;flex-wrap:wrap;padding:16px 28px;background:#dce9ea}nav a{color:#123d47;font-weight:650}section{max-width:1280px;margin:24px auto;padding:26px;background:white;border:1px solid #d4dde3;border-radius:12px}article{border-top:1px solid #d4dde3;padding:18px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.55 ui-monospace,monospace;background:#f2f5f7;padding:14px;border-radius:6px}.narrative{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.65 system-ui,sans-serif}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}td,th{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid #dce3e8;min-width:130px;max-width:420px;overflow-wrap:anywhere}th{background:#e9f1f3}footer{padding:32px;text-align:center;color:#52616d}summary{cursor:pointer;font-weight:600}@media(max-width:700px){header{padding:28px 20px}h1{font-size:29px}section{margin:16px 10px;padding:18px}nav{gap:12px}}</style>"+body+"</html>"
        (OUT/"inventory.html").write_text(document)
        print("Static report assembled:",len(document),"characters")
