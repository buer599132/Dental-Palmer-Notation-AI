import { Quadrant, ToothFinding } from "../types";

export const TOOTH_NAMES: Record<string, string> = {
  // Permanent
  "1": "中切牙",
  "2": "侧切牙",
  "3": "尖牙",
  "4": "第一前磨牙",
  "5": "第二前磨牙",
  "6": "第一磨牙",
  "7": "第二磨牙",
  "8": "第三磨牙",
  // Primary (Letters)
  "A": "乳中切牙",
  "B": "乳侧切牙",
  "C": "乳尖牙",
  "D": "第一乳磨牙",
  "E": "第二乳磨牙",
  // Primary (Roman Numerals - ASCII)
  "I": "乳中切牙",
  "II": "乳侧切牙",
  "III": "乳尖牙",
  "IV": "第一乳磨牙",
  "V": "第二乳磨牙",
  // Primary (Roman Numerals - Unicode)
  "Ⅰ": "乳中切牙",
  "Ⅱ": "乳侧切牙",
  "Ⅲ": "乳尖牙",
  "Ⅳ": "第一乳磨牙",
  "Ⅴ": "第二乳磨牙"
};

// Mapping for sorting purposes (1/A/I -> 1, 8/E/V -> 5 or 8)
export const TOOTH_ORDINAL: Record<string, number> = {
  // Permanent
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
  // Primary A-E
  "A": 1, "B": 2, "C": 3, "D": 4, "E": 5,
  // Primary I-V (ASCII)
  "I": 1, "II": 2, "III": 3, "IV": 4, "V": 5,
  // Primary Roman Unicode
  "Ⅰ": 1, "Ⅱ": 2, "Ⅲ": 3, "Ⅳ": 4, "Ⅴ": 5
};

export const QUADRANT_NAMES: Record<Quadrant, string> = {
  [Quadrant.UPPER_RIGHT]: "右上",
  [Quadrant.UPPER_LEFT]: "左上",
  [Quadrant.LOWER_RIGHT]: "右下",
  [Quadrant.LOWER_LEFT]: "左下",
  [Quadrant.UNKNOWN]: "未知"
};

export const getToothDescription = (num: string, quad: Quadrant): string => {
  const qName = QUADRANT_NAMES[quad] || "";
  const tName = TOOTH_NAMES[num.toUpperCase()] || TOOTH_NAMES[num] || "未知牙位";
  return `${qName}${tName}`;
};

/**
 * Sorts a string of tooth characters based on their quadrant for correct VISUAL representation.
 * 
 * Rules:
 * - Right Quadrants (UR/LR): Vertical line is on the RIGHT. 
 *   To show [5 4 |], the string must be "54" (Right Aligned). 
 *   Sort Order: Distal to Mesial (High Ordinal -> Low Ordinal).
 * 
 * - Left Quadrants (UL/LL): Vertical line is on the LEFT.
 *   To show [| 4 5], the string must be "45" (Left Aligned).
 *   Sort Order: Mesial to Distal (Low Ordinal -> High Ordinal).
 */
export const sortQuadrantTeeth = (text: string, quadrant: Quadrant): string => {
  if (!text) return "";
  
  const isRightSide = quadrant === Quadrant.UPPER_RIGHT || quadrant === Quadrant.LOWER_RIGHT;
  // Split into characters (handle Unicode surrogates properly with ... spread)
  const chars = [...text];
  
  chars.sort((a, b) => {
    const ordA = TOOTH_ORDINAL[a.toUpperCase()] || TOOTH_ORDINAL[a] || 0;
    const ordB = TOOTH_ORDINAL[b.toUpperCase()] || TOOTH_ORDINAL[b] || 0;
    
    if (isRightSide) {
       // Right side (UR/LR): Sort Descending (8 -> 1)
       return ordB - ordA;
    } else {
       // Left side (UL/LL): Sort Ascending (1 -> 8)
       return ordA - ordB;
    }
  });
  
  return chars.join('');
};

export const generateCombinedDescription = (findings: ToothFinding[]): string => {
  const groups: Record<string, ToothFinding[]> = {};

  // Group by Quadrant
  findings.forEach(f => {
    if (!groups[f.quadrant]) {
      groups[f.quadrant] = [];
    }
    groups[f.quadrant].push(f);
  });

  const parts: string[] = [];
  
  // Order: UR, UL, LR, LL
  const order = [Quadrant.UPPER_RIGHT, Quadrant.UPPER_LEFT, Quadrant.LOWER_RIGHT, Quadrant.LOWER_LEFT];
  
  // Helper to sort teeth from midline (1/A/I) to distal (8/E/V)
  const sortTeeth = (a: ToothFinding, b: ToothFinding) => {
    const ordA = TOOTH_ORDINAL[a.toothNumber.toUpperCase()] || TOOTH_ORDINAL[a.toothNumber] || 99;
    const ordB = TOOTH_ORDINAL[b.toothNumber.toUpperCase()] || TOOTH_ORDINAL[b.toothNumber] || 99;

    if (ordA !== ordB) {
        return ordA - ordB;
    }
    
    // Fallback to string comparison if ordinals are same (e.g. mixed notation weirdness)
    return a.toothNumber.localeCompare(b.toothNumber);
  };

  order.forEach(q => {
    if (groups[q] && groups[q].length > 0) {
      // Sort findings specifically to satisfy "Inside to Outside" rule
      const sortedFindings = groups[q].sort(sortTeeth);

      const qName = QUADRANT_NAMES[q];
      const teethNames = sortedFindings.map(f => 
        TOOTH_NAMES[f.toothNumber.toUpperCase()] || TOOTH_NAMES[f.toothNumber] || f.toothNumber
      );
      // Join teeth with '、'
      const teethStr = teethNames.join('、');
      parts.push(`${qName}${teethStr}`);
    }
  });

  // Handle any unknown quadrants
  Object.keys(groups).forEach(key => {
    if (!order.includes(key as Quadrant)) {
      const qName = "未知区域";
      // Also sort unknowns
      const sortedUnknowns = groups[key].sort(sortTeeth);
      const teethNames = sortedUnknowns.map(f => 
        TOOTH_NAMES[f.toothNumber.toUpperCase()] || TOOTH_NAMES[f.toothNumber] || f.toothNumber
      );
      const teethStr = teethNames.join('、');
      parts.push(`${qName}${teethStr}`);
    }
  });

  return parts.join('，');
};