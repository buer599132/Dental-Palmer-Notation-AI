import { AnalysisResult, HistoryItem } from "../types";

const STORAGE_KEY = 'dental_ai_history_v1';

export const saveToHistory = (imageName: string, original: AnalysisResult, corrected: AnalysisResult) => {
  try {
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      imageName,
      originalResult: original,
      correctedResult: corrected
    };

    const existingData = getHistory();
    const newData = [newItem, ...existingData].slice(0, 100); // Limit to last 100 entries to save space
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  } catch (e) {
    console.error("Failed to save history", e);
  }
};

export const getHistory = (): HistoryItem[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const exportHistoryDataset = () => {
  const history = getHistory();
  const blob = new Blob([JSON.stringify(history, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `dental_ai_training_data_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const clearHistory = () => {
  localStorage.removeItem(STORAGE_KEY);
};