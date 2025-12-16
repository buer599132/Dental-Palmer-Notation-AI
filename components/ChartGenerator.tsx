import React, { useState, useRef, useEffect } from 'react';
import { parseDescriptionToChart } from '../services/geminiService';
import { Quadrant, ToothFinding } from '../types';
import { generateCombinedDescription, TOOTH_NAMES, sortQuadrantTeeth } from '../utils/dentalUtils';

export const ChartGenerator: React.FC = () => {
  const [data, setData] = useState({
    UR: '', // Upper Right
    UL: '', // Upper Left
    LR: '', // Lower Right
    LL: ''  // Lower Left
  });
  const [description, setDescription] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [mode, setMode] = useState<'manual' | 'text'>('manual');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw on canvas whenever data changes
  useEffect(() => {
    drawChart();
  }, [data]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Canvas Settings
    const width = 600;
    const height = 400;
    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Font Settings (Must be set before measuring text)
    const fontSize = 64;
    ctx.font = `${fontSize}px "Times New Roman", serif`; 
    ctx.textBaseline = 'middle';

    // 0. Prepare Sorted Display Strings
    // Always sort the text for display to ensure anatomical correctness on the visual chart
    // UR/LR: Sorted 8->1 (Distal to Mesial) because aligned Right against the axis.
    // UL/LL: Sorted 1->8 (Mesial to Distal) because aligned Left against the axis.
    const txtUR = sortQuadrantTeeth(data.UR, Quadrant.UPPER_RIGHT);
    const txtUL = sortQuadrantTeeth(data.UL, Quadrant.UPPER_LEFT);
    const txtLR = sortQuadrantTeeth(data.LR, Quadrant.LOWER_RIGHT);
    const txtLL = sortQuadrantTeeth(data.LL, Quadrant.LOWER_LEFT);

    // 1. Measure Text Dimensions based on SORTED strings
    const wUR = txtUR ? ctx.measureText(txtUR).width : 0;
    const wUL = txtUL ? ctx.measureText(txtUL).width : 0;
    const wLR = txtLR ? ctx.measureText(txtLR).width : 0;
    const wLL = txtLL ? ctx.measureText(txtLL).width : 0;

    // 2. Determine Line Lengths
    const hasAny = !!(data.UR || data.UL || data.LR || data.LL);

    // Layout Constants
    const centerX = width / 2;
    const centerY = height / 2;
    const padding = 15;       // Gap between axis and text
    const lineOverhang = 15;  // How much the line extends beyond the text
    const defaultLen = 100;   // Length to show if chart is completely empty
    
    // Vertical line height usually corresponds to the font size roughly
    const vLineHeight = fontSize + padding; 

    // Calculate dynamic lengths based on widest text in that half
    let lenLeft = hasAny ? 0 : defaultLen;
    if (data.UR || data.LR) {
        lenLeft = Math.max(wUR, wLR) + padding + lineOverhang;
    }

    let lenRight = hasAny ? 0 : defaultLen;
    if (data.UL || data.LL) {
        lenRight = Math.max(wUL, wLL) + padding + lineOverhang;
    }

    let lenTop = hasAny ? 0 : defaultLen;
    if (data.UR || data.UL) {
        lenTop = vLineHeight;
    }

    let lenBottom = hasAny ? 0 : defaultLen;
    if (data.LR || data.LL) {
        lenBottom = vLineHeight;
    }

    // 3. Draw Lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.lineCap = 'square'; 
    ctx.beginPath();

    // Top Vertical
    if (lenTop > 0) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - lenTop);
    }
    // Bottom Vertical
    if (lenBottom > 0) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY + lenBottom);
    }
    // Left Horizontal
    if (lenLeft > 0) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX - lenLeft, centerY);
    }
    // Right Horizontal
    if (lenRight > 0) {
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + lenRight, centerY);
    }
    ctx.stroke();

    // 4. Draw Text using SORTED strings
    ctx.fillStyle = '#000000';
    
    // UR (Upper Right) -> Visual Top Left
    if (txtUR) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(txtUR, centerX - padding, centerY - padding + 5); 
    }

    // UL (Upper Left) -> Visual Top Right
    if (txtUL) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(txtUL, centerX + padding, centerY - padding + 5);
    }

    // LR (Lower Right) -> Visual Bottom Left
    if (txtLR) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(txtLR, centerX - padding, centerY + padding - 5);
    }

    // LL (Lower Left) -> Visual Bottom Right
    if (txtLL) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(txtLL, centerX + padding, centerY + padding - 5);
    }
  };

  const handleManualChange = (quad: keyof typeof data, val: string) => {
    // Only allow alphanumeric AND Roman Numerals (Unicode range 2160-217F)
    const cleaned = val.replace(/[^a-zA-Z0-9\u2160-\u217F]/g, '').toUpperCase();
    setData(prev => ({ ...prev, [quad]: cleaned }));
  };

  const fillPreset = (type: 'permanent' | 'primary') => {
    // Standard Palmer from Midline
    // Right side text inputs (UR/LR) should be "87654321" for correct visual order if manually typing?
    // Actually, users prefer typing 1-8. Our new sortQuadrantTeeth handles the reversal for display.
    // So we can set them to '12345678' and the chart will render '87654321 |' correctly.
    const standard = type === 'permanent' ? '12345678' : 'ABCDE';
    setData({
      UR: standard,
      UL: standard,
      LR: standard,
      LL: standard
    });
  };

  const clearData = () => {
    setData({ UR: '', UL: '', LR: '', LL: '' });
    setDescription('');
  };

  const handleParse = async () => {
    if (!description.trim()) return;
    setIsParsing(true);
    try {
      const parsed = await parseDescriptionToChart(description);
      
      // Auto-sort the parsed data to ensure the Input Fields also look anatomically sorted.
      // This matches the logic used in drawChart, making the UI consistent.
      setData({
        UR: sortQuadrantTeeth(parsed.UR, Quadrant.UPPER_RIGHT),
        UL: sortQuadrantTeeth(parsed.UL, Quadrant.UPPER_LEFT),
        LR: sortQuadrantTeeth(parsed.LR, Quadrant.LOWER_RIGHT),
        LL: sortQuadrantTeeth(parsed.LL, Quadrant.LOWER_LEFT),
      });
      
      setMode('manual'); 
    } catch (e) {
      alert("解析失败，请检查描述格式或网络连接。");
    } finally {
      setIsParsing(false);
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Generate filename based on content
    const findings: ToothFinding[] = [];
    const addFinding = (str: string, q: Quadrant) => {
      for (const char of str) {
        findings.push({
          toothNumber: char,
          quadrant: q,
          description: TOOTH_NAMES[char] || char
        });
      }
    };

    if (data.UR) addFinding(data.UR, Quadrant.UPPER_RIGHT);
    if (data.UL) addFinding(data.UL, Quadrant.UPPER_LEFT);
    if (data.LR) addFinding(data.LR, Quadrant.LOWER_RIGHT);
    if (data.LL) addFinding(data.LL, Quadrant.LOWER_LEFT);

    let filename = "牙位图";
    if (findings.length > 0) {
      const desc = generateCombinedDescription(findings);
      // Clean up description for filename
      filename = desc.replace(/[，、]/g, '_').replace(/\s+/g, '').substring(0, 50); 
    } else {
        filename = "空牙位图";
    }

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="animate-fade-in-up space-y-8">
      
      {/* Mode Switcher */}
      <div className="flex justify-center mb-6">
        <div className="bg-white p-1 rounded-lg border border-gray-200 shadow-sm flex">
          <button 
            onClick={() => setMode('manual')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'manual' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            手动填图
          </button>
          <button 
            onClick={() => setMode('text')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'text' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            AI 描述生成
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        {/* Left: Controls */}
        <div className="space-y-6">
          
          {mode === 'manual' && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
               <div className="flex justify-between items-center">
                 <h3 className="font-bold text-gray-800">四个象限输入</h3>
                 <div className="flex gap-2">
                    <button onClick={() => fillPreset('permanent')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700">恒牙全口 (1-8)</button>
                    <button onClick={() => fillPreset('primary')} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700">乳牙全口 (A-E)</button>
                    <button onClick={clearData} className="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded">清空</button>
                 </div>
               </div>

               {/* Cross Input UI */}
               <div className="relative w-full aspect-[3/2] bg-gray-50 rounded-lg border border-gray-200 flex flex-col">
                  {/* Top Row */}
                  <div className="flex-1 flex border-b-2 border-gray-400">
                    <div className="flex-1 border-r-2 border-gray-400 p-2 flex items-end justify-end">
                      <input 
                        type="text" 
                        placeholder="右上(UR)" 
                        value={data.UR}
                        onChange={(e) => handleManualChange('UR', e.target.value)}
                        className="w-full text-right bg-transparent text-xl font-serif outline-none placeholder:text-gray-300"
                      />
                    </div>
                    <div className="flex-1 p-2 flex items-end justify-start">
                      <input 
                        type="text" 
                        placeholder="左上(UL)" 
                        value={data.UL}
                        onChange={(e) => handleManualChange('UL', e.target.value)}
                        className="w-full text-left bg-transparent text-xl font-serif outline-none placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                  {/* Bottom Row */}
                  <div className="flex-1 flex">
                    <div className="flex-1 border-r-2 border-gray-400 p-2 flex items-start justify-end">
                       <input 
                        type="text" 
                        placeholder="右下(LR)" 
                        value={data.LR}
                        onChange={(e) => handleManualChange('LR', e.target.value)}
                        className="w-full text-right bg-transparent text-xl font-serif outline-none placeholder:text-gray-300"
                      />
                    </div>
                    <div className="flex-1 p-2 flex items-start justify-start">
                       <input 
                        type="text" 
                        placeholder="左下(LL)" 
                        value={data.LL}
                        onChange={(e) => handleManualChange('LL', e.target.value)}
                        className="w-full text-left bg-transparent text-xl font-serif outline-none placeholder:text-gray-300"
                      />
                    </div>
                  </div>
                  
                  {/* Center Labels */}
                  <div className="absolute top-2 left-2 text-[10px] text-gray-400">右上 UR</div>
                  <div className="absolute top-2 right-2 text-[10px] text-gray-400">左上 UL</div>
                  <div className="absolute bottom-2 left-2 text-[10px] text-gray-400">右下 LR</div>
                  <div className="absolute bottom-2 right-2 text-[10px] text-gray-400">左下 LL</div>
               </div>
            </div>
          )}

          {mode === 'text' && (
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
              <h3 className="font-bold text-gray-800">AI 智能解析</h3>
              <p className="text-sm text-gray-500">输入任意中文描述，例如：“右上654，左下第一磨牙”。</p>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                placeholder="请输入牙位描述..."
              />
              <button 
                onClick={handleParse}
                disabled={isParsing || !description.trim()}
                className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
              >
                {isParsing ? (
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : '生成图表'}
              </button>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center gap-4">
          <h3 className="font-bold text-gray-800 w-full text-left">实时预览</h3>
          
          <div className="border border-gray-300 shadow-inner bg-gray-50 p-2">
            <canvas ref={canvasRef} className="w-full max-w-[400px] h-auto bg-white block" />
          </div>

          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm hover:shadow transition-all font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            导出 PNG 图片
          </button>
        </div>
      </div>
    </div>
  );
};