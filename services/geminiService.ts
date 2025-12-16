import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, Quadrant } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    findings: {
      type: Type.ARRAY,
      description: "识别到的所有牙位列表。",
      items: {
        type: Type.OBJECT,
        properties: {
          toothNumber: {
            type: Type.STRING,
            description: "单个牙位的字符。可以是恒牙数字(1-8)，乳牙字母(A-E)，或乳牙罗马数字(I-V/Ⅰ-Ⅴ)。",
          },
          quadrant: {
            type: Type.STRING,
            enum: [
              "右上区 (A区 - UR)",
              "左上区 (B区 - UL)",
              "右下区 (C区 - LR)",
              "左下区 (D区 - LL)",
              "未知"
            ],
            description: "该特定字符所属的象限。",
          },
          description: {
            type: Type.STRING,
            description: "该牙位的完整中文描述 (例如 '右上第一前磨牙')。",
          },
        },
        required: ["toothNumber", "quadrant", "description"],
      },
    },
    combinedDescription: {
      type: Type.STRING,
      description: "将所有识别结果合并成一段通顺的中文话术。必须将同一象限内的牙位合并描述，不要重复象限名称。格式如：'左下第六磨牙、第七磨牙'。",
    },
    missingHorizontalLine: {
      type: Type.BOOLEAN,
      description: "是否缺少区分上下的水平横线？如果只有竖线而没有横线，设为 true。",
    },
    confidence: {
      type: Type.STRING,
      description: "整体识别的可信度 (高, 中, 低).",
    },
    reasoning: {
      type: Type.STRING,
      description: "整体分析推理。解释如何区分这些数字，描述线条结构。",
    },
  },
  required: ["findings", "combinedDescription", "missingHorizontalLine", "confidence", "reasoning"],
};

export const analyzeDentalImage = async (base64Data: string, mimeType: string): Promise<AnalysisResult> => {
  try {
    const modelId = "gemini-2.5-flash"; // Using Flash for speed and good vision capabilities

    const prompt = `
      你是一名精通帕尔默牙位标记法（Palmer Notation Method）的专家级牙科助手。
      请分析提供的牙科图表记录图像。图片中可能包含**一个或多个**牙位记录。

      **任务目标：**
      1. 找出图像中所有的数字、字母或符号。
         - **恒牙**：阿拉伯数字 1-8。
         - **乳牙**：英文字母 A-E 或 **罗马数字 I-V (Ⅰ-Ⅴ)**。
      2. 针对**每一个**找到的标记，单独判断其所属的象限。
      3. 生成一段包含所有识别结果的**完整描述句子**。
      4. **检测边框线完整性**：特别注意是否缺少水平线。

      **严格命名标准 (参照教科书):**
      
      【恒牙 1-8】
      1: 中切牙
      2: 侧切牙
      3: 尖牙
      4: 第一前磨牙
      5: 第二前磨牙
      6: 第一磨牙
      7: 第二磨牙
      8: 第三磨牙

      【乳牙 A-E 或 I-V】
      A / I  / Ⅰ : 乳中切牙
      B / II / Ⅱ : 乳侧切牙
      C / III/ Ⅲ : 乳尖牙
      D / IV / Ⅳ : 第一乳磨牙
      E / V  / Ⅴ : 第二乳磨牙

      **combinedDescription 生成规则 (合并描述):**
      - 必须将属于**同一象限**的牙位合并描述。
      - **重要排序规则**：描述牙位时，必须始终遵循**从里到外**（即从近中到远中，从 1 到 8）的顺序。
      - **示例 (右上区)**：
        - 图像显示："6 5 4" (视觉上从左到右)。
        - 正确描述："右上第一前磨牙(4)、第二前磨牙(5)、第一磨牙(6)"。
        - 错误描述："右上第一磨牙(6)、第二前磨牙(5)..."。
      - 格式："[象限名称][牙齿1]、[牙齿2]..."。
      - 不同象限之间用逗号分隔。

      **判定原则（基于字符与线条的相对位置）：**
      - **竖线**区分左右：
        - 字符位于竖线**左侧** -> 属于患者的**右侧象限** (UR 或 LR)。
        - 字符位于竖线**右侧** -> 属于患者的**左侧象限** (UL 或 LL)。
      - **横线**区分上下：
        - 字符位于横线**上方** -> 属于**上颌** (UR 或 UL)。
        - 字符位于横线**下方** -> 属于**下颌** (LR 或 LL)。

      **特殊规则：缺失水平线**
      - 如果图像中**只有竖线，没有明显的横线**（例如 "54|45" 没有任何上划线或下划线）：
        - 请将 \`missingHorizontalLine\` 字段设为 \`true\`。
        - 默认将这些牙位归类为**上颌** (UR 或 UL) 进行输出。用户将在界面上进行手动确认。

      **常规象限特征（当横线存在时）：**
      - **右上区 (UR/A区)**: 符号 ┘ (竖线在右，横线在下)。
      - **左上区 (UL/B区)**: 符号 └ (竖线在左，横线在下)。
      - **右下区 (LR/C区)**: 符号 ┐ (竖线在右，横线在上)。
      - **左下区 (LL/D区)**: 符号 ┌ (竖线在左，横线在上)。

      请输出 JSON 结果。如果识别到罗马数字，请直接输出罗马数字字符（如 Ⅴ），不要转换为字母或数字。
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Data,
              },
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1, 
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("Gemini API 未返回数据。");
    }

    const result = JSON.parse(text) as AnalysisResult;
    return result;

  } catch (error) {
    console.error("Error analyzing dental image:", error);
    throw error;
  }
};

// --- Chart Generation Helpers ---

export interface ParsedChartData {
  UR: string;
  UL: string;
  LR: string;
  LL: string;
}

export const parseDescriptionToChart = async (description: string): Promise<ParsedChartData> => {
  try {
    const modelId = "gemini-2.5-flash"; 

    const prompt = `
      将以下牙位描述转换为帕尔默记录法（Palmer Notation）的四个象限数据。
      输入描述： "${description}"

      请提取每个象限对应的牙位编号（数字1-8或字母A-E或罗马数字I-V）。
      
      规则：
      - UR (Upper Right) = 右上区 (患者右侧，视角左上)
      - UL (Upper Left) = 左上区 (患者左侧，视角右上)
      - LR (Lower Right) = 右下区
      - LL (Lower Left) = 左下区
      - 如果描述中没有提及某个象限，该字段留空字符串。
      - 输出仅包含标记符号，不要包含中文。
      - 顺序：保持输入描述中的相对顺序，或者按照从近中到远中顺序排列。

      返回 JSON 格式: { UR: string, UL: string, LR: string, LL: string }
    `;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        UR: { type: Type.STRING },
        UL: { type: Type.STRING },
        LR: { type: Type.STRING },
        LL: { type: Type.STRING },
      },
      required: ["UR", "UL", "LR", "LL"],
    };

    const response = await ai.models.generateContent({
      model: modelId,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
      },
    });

    const text = response.text;
    if (!text) throw new Error("API response empty");
    
    return JSON.parse(text) as ParsedChartData;

  } catch (error) {
    console.error("Error parsing description:", error);
    throw error;
  }
};
