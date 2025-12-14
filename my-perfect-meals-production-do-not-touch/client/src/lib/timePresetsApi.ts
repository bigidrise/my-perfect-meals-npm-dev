const API = (path: string) => "/api" + path;

export interface TimePreset {
  id: string;
  userId: string;
  name: string;
  times: {
    b: string | null; // breakfast
    l: string | null; // lunch
    d: string | null; // dinner
    s: string[];     // snacks
  };
  notify: {
    b: boolean;
    l: boolean;
    d: boolean;
    s: boolean;
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listTimePresets = async (userId: string): Promise<{ presets: TimePreset[] }> => {
  const response = await fetch(`${API("/time-presets")}?userId=${userId}`);
  return response.json();
};

export const saveTimePreset = async (payload: {
  userId: string;
  id?: string;
  name: string;
  times: { b: string | null; l: string | null; d: string | null; s: string[] };
  notify: { b: boolean; l: boolean; d: boolean; s: boolean };
  isDefault?: boolean;
}): Promise<{ ok: boolean; id: string }> => {
  const response = await fetch(API("/time-presets/save"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return response.json();
};

export const deleteTimePreset = async (userId: string, id: string): Promise<{ ok: boolean }> => {
  const response = await fetch(API("/time-presets/delete"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, id }),
  });
  return response.json();
};

export const getDefaultTimePreset = async (userId: string): Promise<{ preset: TimePreset | null }> => {
  const response = await fetch(`${API("/time-presets/default")}?userId=${userId}`);
  return response.json();
};