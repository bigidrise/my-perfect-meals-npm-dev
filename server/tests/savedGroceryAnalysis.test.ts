import { createSavedGroceryAnalyzer, attachSavedGroceryAnalysis, savedAnalysisRevision, type SavedAnalysisRow, type SavedAnalysisStore } from "../services/savedGroceryAnalysis";
import { savedEvidenceRevision } from "../services/savedGroceryEvidence";

const output = () => ({ productName: "Independently analyzed bar", alignmentGrade: "B", gradeUnavailable: false,
  overallSummary: "The bar's own analysis", verdict: "The bar's own Chef explanation", verdictLevel: "caution",
  analysisMethod: "by_name", fallbackUsed: false, betterAlternatives: [], whatMattersMost: ["Its own useful point"],
  extractedIngredients: [], ingredientConsiderations: [], profileFactorsUsed: [] } as any);
const fixture = (): SavedAnalysisRow => ({ id: "saved-bar", userId: "owner-a", productName: "Protein Bar", brand: "RXBAR",
  productKey: "name::rxbar::proteinbar", barcode: "known-upc", source: "grocery-coach", category: "Snack",
  nutritionJson: { carbs: 20, servingBasis: "one bar" },
  productMeta: { subjectKind: "human", packageSize: "12 bars", recommendationWhyBetter: ["Original recommendation"],
    recommendationTargetCriteria: "Original criteria", ingredients: ["Known label ingredient"], evidenceStatus: "verified" } });

function harness() {
  let row: SavedAnalysisRow | null = fixture();
  let failCompletion = false;
  let queue = Promise.resolve();
  const store: SavedAnalysisStore = {
    withItem(owner, id, change) {
      const operation = queue.then(() => {
        const owned = row?.userId === owner && row.id === id ? structuredClone(row) : null;
        const mutation = change(owned);
        if (mutation.productMeta) {
          if (failCompletion && mutation.productMeta.analysisRequest?.state === "completed") throw new Error("Synthetic write outage");
          row = { ...row!, productMeta: structuredClone(mutation.productMeta) };
        }
        return mutation.value;
      });
      queue = operation.then(() => undefined, () => undefined);
      return operation;
    },
  };
  const ai = jest.fn(async () => output());
  const request = () => ({ requestId: "analysis-operation-0001", expectedRevision: savedEvidenceRevision(row!) });
  return { store, ai, run: createSavedGroceryAnalyzer(store, ai), request,
    row: () => row, change: (fn: (item: SavedAnalysisRow) => void) => fn(row!), remove: () => { row = null; },
    failCompletion: () => { failCompletion = true; } };
}

test("analyzes the owned product, persists independently generated analysis, and preserves original identity, source, recommendation and label evidence", async () => {
  const h = harness(), before = structuredClone(h.row());
  const response = await h.run("owner-a", "saved-bar", h.request());
  expect(h.ai).toHaveBeenCalledWith("RXBAR Protein Bar", "owner-a");
  expect(response.reused).toBe(false);
  expect(h.row()).toMatchObject(before!);
  expect(h.row()!.productMeta!.analysisSnapshot).toMatchObject({ alignmentGrade: "B", productName: "RXBAR Protein Bar" });
  expect(h.row()!.productMeta!.analysisRequest.state).toBe("completed");
  const again = await h.run("owner-a", "saved-bar", h.request());
  expect(again.reused).toBe(true);
  expect(h.ai).toHaveBeenCalledTimes(1);
});

test("wrong-account and missing IDs fail without analyzing or changing any record", async () => {
  const h = harness();
  await expect(h.run("owner-b", "saved-bar", h.request())).rejects.toMatchObject({ status: 404 });
  await expect(h.run("owner-a", "another-item", h.request())).rejects.toMatchObject({ status: 404 });
  expect(h.ai).not.toHaveBeenCalled();
});

test("an existing complete label scan is returned exactly without generating or rewriting it", async () => {
  const h = harness();
  h.change(row => { row.productMeta!.analysisSnapshot = { ...output(), analysisMethod: "by_label", alignmentGrade: "C" }; });
  const before = structuredClone(h.row());
  const response = await h.run("owner-a", "saved-bar", h.request());
  expect(response.reused).toBe(true);
  expect(h.row()).toEqual(before);
  expect(h.ai).not.toHaveBeenCalled();
});

test("stale or invalid requests never incur an AI request", async () => {
  const h = harness(), old = h.request();
  h.change(row => { row.productMeta!.packageSize = "6 bars"; });
  await expect(h.run("owner-a", "saved-bar", old)).rejects.toMatchObject({ code: "stale_record" });
  await expect(h.run("owner-a", "saved-bar", {})).rejects.toMatchObject({ status: 400 });
  expect(h.ai).not.toHaveBeenCalled();
});

test("companion recommendations never reach human analysis", async () => {
  const h = harness(); h.change(row => { row.productMeta!.subjectKind = "companion"; });
  await expect(h.run("owner-a", "saved-bar", h.request())).rejects.toMatchObject({ code: "companion_record" });
  expect(h.ai).not.toHaveBeenCalled();
});

test("a non-recommendation legacy record cannot be silently overwritten", async () => {
  const h = harness(); h.change(row => { row.productMeta = { alignmentGrade: "C", analysisMethod: "by_label" }; });
  await expect(h.run("owner-a", "saved-bar", h.request())).rejects.toMatchObject({ code: "not_recommendation" });
  expect(h.ai).not.toHaveBeenCalled();
});

test("separate analyzer instances share the durable claim and prevent concurrent paid requests", async () => {
  const h = harness(), request = h.request();
  let finish!: (value: any) => void;
  h.ai.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = h.run("owner-a", "saved-bar", request);
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  const secondProcess = createSavedGroceryAnalyzer(h.store, h.ai);
  await expect(secondProcess("owner-a", "saved-bar", { ...request, requestId: "analysis-operation-0002" }))
    .rejects.toMatchObject({ code: "analysis_in_progress" });
  expect(h.ai).toHaveBeenCalledTimes(1);
  finish(output());
  await first;
});

test("a durable pending request after a server interruption fails closed, without a timed automatic paid retry", async () => {
  const h = harness();
  h.change(row => { row.productMeta!.analysisRequest = { state: "running", requestId: "interrupted-operation", startedAt: "2020-01-01" }; });
  await expect(h.run("owner-a", "saved-bar", h.request())).rejects.toMatchObject({ code: "analysis_in_progress" });
  expect(h.ai).not.toHaveBeenCalled();
});

test.each(["delete", "evidence", "identity"] as const)("a %s change during analysis does not recreate or overwrite the saved product", async change => {
  const h = harness();
  h.ai.mockImplementation(async () => {
    if (change === "delete") h.remove();
    else if (change === "evidence") h.change(row => { row.productMeta!.ingredients = ["Updated label"]; });
    else h.change(row => { row.productName = "Different bar"; });
    return output();
  });
  await expect(h.run("owner-a", "saved-bar", h.request())).rejects.toMatchObject({ code: change === "delete" ? "not_found" : "stale_record" });
  expect(h.row()?.productMeta?.analysisSnapshot).toBeUndefined();
  if (change === "evidence") expect(h.row()!.productMeta!.ingredients).toEqual(["Updated label"]);
});

test("AI failure preserves the recommendation, and replaying the same failed request cannot incur another charge", async () => {
  const h = harness(), request = h.request();
  h.ai.mockRejectedValue(new Error("Synthetic provider failure"));
  await expect(h.run("owner-a", "saved-bar", request)).rejects.toMatchObject({ code: "analysis_unavailable" });
  await expect(h.run("owner-a", "saved-bar", request)).rejects.toMatchObject({ code: "previous_request_failed" });
  expect(h.ai).toHaveBeenCalledTimes(1);
  expect(h.row()!.productMeta!.recommendationWhyBetter).toEqual(["Original recommendation"]);
  expect(h.row()!.productMeta!.analysisSnapshot).toBeUndefined();
});

test("an incomplete AI response is not persisted as a full result or given a manufactured grade", async () => {
  const h = harness(); h.ai.mockResolvedValue({ ...output(), fallbackUsed: true });
  await expect(h.run("owner-a", "saved-bar", h.request())).rejects.toMatchObject({ code: "analysis_unavailable" });
  expect(h.row()!.productMeta!.analysisSnapshot).toBeUndefined();
});

test("a complete result without a supported grade is saved honestly, and not reanalyzed on reopening", async () => {
  const h = harness(); h.ai.mockResolvedValue({ ...output(), alignmentGrade: "", gradeUnavailable: true });
  await h.run("owner-a", "saved-bar", h.request());
  expect(h.row()!.productMeta!.analysisSnapshot.gradeUnavailable).toBe(true);
  await h.run("owner-a", "saved-bar", h.request());
  expect(h.ai).toHaveBeenCalledTimes(1);
});

test("uncertain persistence leaves a durable claim to prevent another paid request", async () => {
  const h = harness(); h.failCompletion();
  const request = h.request();
  await expect(h.run("owner-a", "saved-bar", request)).rejects.toMatchObject({ code: "persistence_uncertain" });
  await expect(h.run("owner-a", "saved-bar", request)).rejects.toMatchObject({ code: "analysis_in_progress" });
  expect(h.row()!.productMeta!.analysisRequest.state).toBe("running");
  expect(h.ai).toHaveBeenCalledTimes(1);
});

function attachment(h: ReturnType<typeof harness>, method = "by_name") {
  return { expectedAnalysisRevision: savedAnalysisRevision(h.row()!), subjectKind: "human",
    analysis: { ...output(), productName: "RXBAR Protein Bar", analysisMethod: method } };
}

test.each(["by_name", "by_label", "full_product_advisor"])("attaches an existing %s snapshot to the same record without AI or altering original evidence", async method => {
  const h = harness();
  h.change(row => { row.productMeta!.evidenceStatus = "unverified"; });
  const before = structuredClone(h.row()), input = attachment(h, method);
  const saved = await attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", input);
  expect(saved).toMatchObject(before!);
  expect(saved.id).toBe(before!.id);
  expect(saved.productMeta!.analysisSnapshot).toEqual(input.analysis);
  expect(saved.productMeta!.evidenceStatus).toBe("unverified");
  expect(saved.productMeta!.ingredients).toEqual(["Known label ingredient"]);
  expect(saved.nutritionJson).toEqual(before!.nutritionJson);
  const reopened = await h.run("owner-a", "saved-bar", h.request());
  expect(reopened.reused).toBe(true);
  expect(reopened.item.productMeta!.analysisSnapshot).toEqual(input.analysis);
  expect(h.ai).not.toHaveBeenCalled();
});

test("snapshot attachment rejects wrong accounts, missing IDs, another product and conflicting barcodes without any AI", async () => {
  const h = harness(), input = attachment(h), before = structuredClone(h.row());
  await expect(attachSavedGroceryAnalysis(h.store, "owner-b", "saved-bar", input)).rejects.toMatchObject({ status: 404 });
  await expect(attachSavedGroceryAnalysis(h.store, "owner-a", "other-id", input)).rejects.toMatchObject({ status: 404 });
  for (const analysis of [{ ...input.analysis, productName: "Parmesan" }, { ...input.analysis, barcode: "other-upc" }]) {
    await expect(attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", { ...input, analysis })).rejects.toMatchObject({ code: "identity_mismatch" });
  }
  expect(h.row()).toEqual(before);
  expect(h.ai).not.toHaveBeenCalled();
});

test.each(["name", "brand", "barcode", "key", "source", "package", "analysis"])("snapshot attachment rejects a stale %s even when the old evidence token might not detect identity changes", async field => {
  const h = harness(), input = attachment(h);
  h.change(row => {
    if (field === "name") row.productName = "Another product";
    else if (field === "brand") row.brand = "Another brand";
    else if (field === "barcode") row.barcode = "other-upc";
    else if (field === "key") row.productKey = "other-key";
    else if (field === "source") row.source = "scanner";
    else if (field === "package") row.productMeta!.packageSize = "6 bars";
    else row.productMeta!.analysisSnapshot = output();
  });
  const before = structuredClone(h.row());
  await expect(attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", input)).rejects.toMatchObject({ code: "stale_record" });
  expect(h.row()).toEqual(before);
  expect(h.ai).not.toHaveBeenCalled();
});

test("concurrent attachment requests cannot overwrite the winning snapshot", async () => {
  const h = harness(), input = attachment(h);
  const responses = await Promise.allSettled([
    attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", input),
    attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", { ...input, analysis: { ...input.analysis, verdict: "Other result" } }),
  ]);
  expect(responses.map(response => response.status)).toEqual(["fulfilled", "rejected"]);
  expect(h.row()!.productMeta!.analysisSnapshot.verdict).toBe(input.analysis.verdict);
  expect(h.ai).not.toHaveBeenCalled();
});

test("attachment never replaces a complete saved analysis or a running generation", async () => {
  const h = harness();
  h.change(row => { row.productMeta!.analysisSnapshot = output(); });
  await expect(attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", attachment(h))).rejects.toMatchObject({ code: "analysis_already_saved" });
  h.change(row => { delete row.productMeta!.analysisSnapshot; row.productMeta!.analysisRequest = { state: "running" }; });
  await expect(attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", attachment(h))).rejects.toMatchObject({ code: "analysis_in_progress" });
  expect(h.ai).not.toHaveBeenCalled();
});

test("attachment retains a partial historical snapshot and rejects incomplete or mixed-subject inputs", async () => {
  const h = harness(), partial = { retained: "Original partial assessment" };
  h.change(row => { row.productMeta!.analysisSnapshot = partial; });
  const input = attachment(h);
  await expect(attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", { ...input, subjectKind: "companion" })).rejects.toMatchObject({ code: "subject_mismatch" });
  await expect(attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", { ...input, analysis: { ...input.analysis, fallbackUsed: true } })).rejects.toMatchObject({ code: "invalid_snapshot" });
  await attachSavedGroceryAnalysis(h.store, "owner-a", "saved-bar", input);
  expect(h.row()!.productMeta!.previousAnalysisSnapshots).toEqual([partial]);
  expect(h.ai).not.toHaveBeenCalled();
});
