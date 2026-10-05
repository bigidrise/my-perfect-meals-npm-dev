import { readOncologySupportSelection, type OncologySupportSelection } from "../../../shared/oncologySupportSelection";

type Request = (path: string, init?: RequestInit) => Promise<any>;

/** Inject the authenticated request wrapper; also exercised against the real router in tests. */
export async function loadOncologySupportSelection(subjectId: string, request: Request, signal?: AbortSignal) {
  const data = await request(`/api/pro/oncology-support/${encodeURIComponent(subjectId)}`, { signal });
  return readOncologySupportSelection(data.oncologySupportContext);
}

export async function saveOncologySupportSelection(subjectId: string, selection: OncologySupportSelection, request: Request) {
  const payload = readOncologySupportSelection(selection);
  const data = await request(`/api/pro/oncology-support/${encodeURIComponent(subjectId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return readOncologySupportSelection(data.oncologySupportContext);
}
