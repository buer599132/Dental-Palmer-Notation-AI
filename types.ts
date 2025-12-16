export enum Quadrant {
  UPPER_RIGHT = '右上区 (A区 - UR)',
  UPPER_LEFT = '左上区 (B区 - UL)',
  LOWER_RIGHT = '右下区 (C区 - LR)',
  LOWER_LEFT = '左下区 (D区 - LL)',
  UNKNOWN = '未知'
}

export interface ToothFinding {
  toothNumber: string;
  quadrant: Quadrant;
  description: string;
}

export interface AnalysisResult {
  findings: ToothFinding[];
  combinedDescription: string;
  missingHorizontalLine: boolean;
  confidence: string;
  reasoning: string;
}

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  base64: string;
  mimeType: string;
  status: 'idle' | 'analyzing' | 'success' | 'error';
  result?: AnalysisResult;
  error?: string;
  progress?: number; 
  manualJawOverride?: boolean; // Legacy quick-fix flag
  isCorrected?: boolean; // Flag if user manually edited the result
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  imageName: string;
  originalResult: AnalysisResult;
  correctedResult: AnalysisResult;
}