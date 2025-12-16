import React, { useState, useEffect } from 'react';
import { AnalysisResult, Quadrant, ToothFinding } from '../types';
import { getToothDescription, generateCombinedDescription, TOOTH_NAMES } from '../utils/dentalUtils';

interface ResultCardProps {
  result: AnalysisResult;
  manualJawOverride?: boolean;
  onUpdateResult?: (newResult: AnalysisResult) => void;
  onToggleJaw?: (isLower: boolean) => void;
}

export const ResultCard: React.FC<ResultCardProps> = ({ 
  result, 
  manualJawOverride = false, 
  onUpdateResult,
  onToggleJaw 
}) => {
  
  const [isEditing, setIsEditing] = useState(false);
  const [editedFindings, setEditedFindings] = useState<ToothFinding[]>([]);

  useEffect(() => {
    setEditedFindings(result.findings);
  }, [result]);

  // --- Display Logic Helpers ---
  const swapQuadrant = (q: Quadrant): Quadrant => {
    switch (q) {
      case Quadrant.UPPER_RIGHT: return Quadrant.LOWER_RIGHT;
      case Quadrant.UPPER_LEFT: return Quadrant.LOWER_LEFT;
      case Quadrant.LOWER_RIGHT: return Quadrant.UPPER_RIGHT;
      case Quadrant.LOWER_LEFT: return Quadrant.UPPER_LEFT;
      default: return q;
    }
  };

  const processTextForJaw = (text: string) => {
    if (!manualJawOverride) return text;
    return text.replace(/右上/g, '右下').replace(/左上/g, '左下').replace(/上颌/g, '下颌');
  };

  // Determine what to show (Edited > Overridden > Original)
  const activeFindings = isEditing ? editedFindings : result.findings.map(f => {
    if (!result.missingHorizontalLine || !manualJawOverride) return f;
    return {
      ...f,
      quadrant: swapQuadrant(f.quadrant),
      description: processTextForJaw(f.description)
    };
  });

  // CRITICAL CHANGE: Always generate description locally to ensure "Inside-to-Outside" (1->8) sorting.
  // We no longer rely on `result.combinedDescription` from the AI for display, as it might be visually ordered (left-to-right).
  const generatedDesc = generateCombinedDescription(activeFindings);
  const activeDescription = generatedDesc;

  // --- Edit Logic Handlers ---

  const handleQuadrantChange = (index: number, newQuad: Quadrant) => {
    const newFindings = [...editedFindings];
    newFindings[index].quadrant = newQuad;
    newFindings[index].description = getToothDescription(newFindings[index].toothNumber, newQuad);
    setEditedFindings(newFindings);
  };

  const handleToothNumChange = (index: number, newNum: string) => {
    const newFindings = [...editedFindings];
    newFindings[index].toothNumber = newNum.toUpperCase();
    newFindings[index].description = getToothDescription(newNum.toUpperCase(), newFindings[index].quadrant);
    setEditedFindings(newFindings);
  };

  const handleDeleteFinding = (index: number) => {
    const newFindings = [...editedFindings];
    newFindings.splice(index, 1);
    setEditedFindings(newFindings);
  };

  const handleAddFinding = () => {
    setEditedFindings([
      ...editedFindings,
      {
        toothNumber: "1",
        quadrant: Quadrant.UPPER_RIGHT,
        description: getToothDescription("1", Quadrant.UPPER_RIGHT)
      }
    ]);
  };

  const handleSaveEdit = () => {
    if (onUpdateResult) {
      const newResult: AnalysisResult = {
        ...result,
        findings: editedFindings,
        combinedDescription: generateCombinedDescription(editedFindings),
        // If user manually edits, we assume they fixed lines too, so we disable the "missing line" warning visually in future
        missingHorizontalLine: false 
      };
      onUpdateResult(newResult);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedFindings(result.findings);
    setIsEditing(false);
  };

  // --- Icons ---
  const getQuadrantIcon = (finding: ToothFinding) => {
    const { quadrant, toothNumber } = finding;
    const baseClass = "w-14 h-14 flex items-center justify-center bg-blue-50 relative transition-all duration-300";
    const textClass = "text-xl font-bold text-gray-800";

    switch (quadrant) {
      case Quadrant.UPPER_LEFT:
        return <div className={`${baseClass} border-l-4 border-b-4 border-blue-600`}><span className={`${textClass} translate-x-1 -translate-y-1`}>{toothNumber}</span></div>;
      case Quadrant.UPPER_RIGHT:
        return <div className={`${baseClass} border-r-4 border-b-4 border-blue-600`}><span className={`${textClass} -translate-x-1 -translate-y-1`}>{toothNumber}</span></div>;
      case Quadrant.LOWER_LEFT:
        return <div className={`${baseClass} border-l-4 border-t-4 border-blue-600`}><span className={`${textClass} translate-x-1 translate-y-1`}>{toothNumber}</span></div>;
      case Quadrant.LOWER_RIGHT:
        return <div className={`${baseClass} border-r-4 border-t-4 border-blue-600`}><span className={`${textClass} -translate-x-1 translate-y-1`}>{toothNumber}</span></div>;
      default:
        return <div className="text-gray-400 font-bold text-xl">?</div>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden animate-fade-in-up">
      <div className={`px-6 py-4 flex justify-between items-center ${isEditing ? 'bg-amber-500' : 'bg-blue-600'}`}>
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          {isEditing ? (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a5.25 5.25 0 00-1.32 2.214l-.8 2.685a.75.75 0 00.933.933l2.685-.8a5.25 5.25 0 002.214-1.32L19.513 8.2z" />
              </svg>
              纠错模式
            </>
          ) : '识别结果'}
        </h2>
        <div className="flex items-center gap-3">
          {!isEditing && (
            <>
              <span className="text-blue-100 text-sm hidden sm:inline">共发现 {activeFindings.length} 个牙位</span>
              <button 
                onClick={() => setIsEditing(true)}
                className="bg-white/20 hover:bg-white/30 text-white text-xs px-3 py-1.5 rounded-full font-medium transition-colors flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                  <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                </svg>
                纠错/编辑
              </button>
            </>
          )}
          {isEditing && (
             <div className="flex gap-2">
               <button onClick={handleCancelEdit} className="text-white/80 hover:text-white text-xs font-medium px-2">取消</button>
               <button onClick={handleSaveEdit} className="bg-white text-amber-600 hover:bg-amber-50 text-xs px-3 py-1.5 rounded-md font-bold shadow-sm">保存修正</button>
             </div>
          )}
        </div>
      </div>
      
      <div className="p-6 space-y-6">
        
        {/* Description Section */}
        <div className={`${isEditing ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'} p-4 rounded-lg border transition-colors`}>
          <h3 className={`text-sm font-semibold ${isEditing ? 'text-amber-800' : 'text-blue-800'} mb-2 uppercase tracking-wide`}>
            {isEditing ? '实时预览描述 (自动生成)' : '完整描述'}
          </h3>
          <p className="text-lg text-gray-900 font-medium leading-relaxed">
            {activeDescription}
          </p>
        </div>

        {/* Quick Jaw Override (Hidden in Edit Mode or if line not missing) */}
        {!isEditing && result.missingHorizontalLine && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
             {/* ...existing override UI... */}
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5">
                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              <div>
                <h4 className="font-bold text-amber-800 text-sm">缺少横线：快捷颌位修正</h4>
                <p className="text-amber-700 text-xs mt-1">
                  AI 未检测到横线。若需精细调整请点击右上角“纠错”。
                </p>
              </div>
            </div>
            
            <div className="flex bg-white rounded-lg p-1 border border-amber-200 shadow-sm">
              <button
                onClick={() => onToggleJaw?.(false)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${!manualJawOverride ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                上颌
              </button>
              <button
                onClick={() => onToggleJaw?.(true)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${manualJawOverride ? 'bg-amber-500 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                下颌
              </button>
            </div>
          </div>
        )}

        {/* Findings Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeFindings.map((finding, index) => (
            <div key={index} className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${isEditing ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
              
              {/* Icon / Visualizer */}
              <div className="flex-shrink-0">
                {getQuadrantIcon(finding)}
              </div>

              {/* Edit Controls vs Display Text */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-2">
                    <select 
                      value={finding.quadrant} 
                      onChange={(e) => handleQuadrantChange(index, e.target.value as Quadrant)}
                      className="text-xs p-1 border border-amber-300 rounded focus:ring-amber-500 focus:border-amber-500"
                    >
                      <option value={Quadrant.UPPER_RIGHT}>右上 (UR)</option>
                      <option value={Quadrant.UPPER_LEFT}>左上 (UL)</option>
                      <option value={Quadrant.LOWER_RIGHT}>右下 (LR)</option>
                      <option value={Quadrant.LOWER_LEFT}>左下 (LL)</option>
                    </select>

                    <select 
                      value={finding.toothNumber}
                      onChange={(e) => handleToothNumChange(index, e.target.value)}
                      className="text-xs p-1 border border-amber-300 rounded focus:ring-amber-500 focus:border-amber-500"
                    >
                       <optgroup label="恒牙 (1-8)">
                         {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n.toString()}>{n} - {TOOTH_NAMES[n.toString()]}</option>)}
                       </optgroup>
                       <optgroup label="乳牙 (字母)">
                         {['A','B','C','D','E'].map(n => <option key={n} value={n}>{n} - {TOOTH_NAMES[n]}</option>)}
                       </optgroup>
                       <optgroup label="乳牙 (罗马数字)">
                         {['I','II','III','IV','V'].map(n => <option key={n} value={n}>{n} - {TOOTH_NAMES[n]}</option>)}
                       </optgroup>
                    </select>
                  </div>
                ) : (
                  <>
                    <p className="text-lg font-bold text-gray-900 truncate">{finding.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                      <span className="bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-700 font-mono text-xs">
                        {finding.toothNumber}
                      </span>
                      <span className="truncate">{finding.quadrant.split(' ')[0]}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Delete Button (Edit Mode Only) */}
              {isEditing && (
                <button 
                  onClick={() => handleDeleteFinding(index)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                  title="删除此结果"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                  </svg>
                </button>
              )}
            </div>
          ))}
          
          {/* Add Button (Edit Mode Only) */}
          {isEditing && (
            <button 
              onClick={handleAddFinding}
              className="flex items-center justify-center gap-2 p-4 border-2 border-dashed border-amber-300 rounded-lg text-amber-600 hover:bg-amber-50 hover:border-amber-400 transition-colors font-medium"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              添加漏检牙位
            </button>
          )}
        </div>

        {/* Reasoning Section (Read-only) */}
        {!isEditing && (
          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              AI 推理分析
            </h4>
            <p className="text-sm text-gray-600 leading-relaxed bg-blue-50/50 p-4 rounded-md border border-blue-100">
              {result.reasoning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};