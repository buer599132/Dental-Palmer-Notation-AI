import React, { useState, useRef } from 'react';
import { ResultCard } from './ResultCard';
import { analyzeDentalImage } from '../services/geminiService';
import { saveToHistory, exportHistoryDataset, getHistory } from '../services/historyService';
import { generateCombinedDescription } from '../utils/dentalUtils';
import { AnalysisResult, UploadedImage } from '../types';

export const ImageRecognition: React.FC = () => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showUrlModal, setShowUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isImportingUrls, setIsImportingUrls] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []) as File[];
    if (files.length === 0) return;

    const newImagesPromises = files.map(file => processFile(file));
    const newImages = await Promise.all(newImagesPromises);
    
    setImages(prev => [...prev, ...newImages]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = (file: File): Promise<UploadedImage> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const resultStr = e.target?.result as string;
        const base64Content = resultStr.split(',')[1];
        
        resolve({
          id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          file,
          previewUrl: resultStr,
          base64: base64Content,
          mimeType: file.type,
          status: 'idle',
          progress: 0,
          manualJawOverride: false,
          isCorrected: false
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const processUrl = async (url: string): Promise<UploadedImage> => {
    const id = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    const fileName = url.split('/').pop() || 'image.jpg';
    
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const blob = await response.blob();
      if (!blob.type.startsWith('image/')) throw new Error('URL 返回的不是图片类型');

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const resultStr = reader.result as string;
          const base64Content = resultStr.split(',')[1];
          resolve({
            id,
            file: new File([blob], fileName, { type: blob.type }),
            previewUrl: resultStr,
            base64: base64Content,
            mimeType: blob.type,
            status: 'idle',
            progress: 0,
            manualJawOverride: false,
            isCorrected: false
          });
        };
        reader.onerror = () => {
             throw new Error("读取图片数据失败");
        };
        reader.readAsDataURL(blob);
      });
    } catch (error: any) {
      // Return an error state image so user knows which URL failed
      return {
        id,
        file: new File([], fileName),
        previewUrl: '', 
        base64: '',
        mimeType: '',
        status: 'error',
        error: `无法加载图片: ${error.message || 'CORS 跨域限制或网络错误'}`,
        progress: 0,
        manualJawOverride: false,
        isCorrected: false
      };
    }
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) return;
    
    setIsImportingUrls(true);
    const urls = urlInput.split('\n').map(u => u.trim()).filter(u => u);
    
    const promises = urls.map(url => processUrl(url));
    const newImages = await Promise.all(promises);
    
    setImages(prev => [...prev, ...newImages]);
    setIsImportingUrls(false);
    setShowUrlModal(false);
    setUrlInput('');
  };

  const analyzeSingleImage = async (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, status: 'analyzing', error: undefined, progress: 10 } : img
    ));

    const progressInterval = setInterval(() => {
      setImages(prev => prev.map(img => {
        if (img.id === id && img.status === 'analyzing') {
          const newProgress = (img.progress || 0) + 10;
          return { ...img, progress: newProgress > 90 ? 90 : newProgress };
        }
        return img;
      }));
    }, 500);

    const targetImage = images.find(img => img.id === id);
    if (!targetImage) {
      clearInterval(progressInterval);
      return;
    }

    try {
      const data = await analyzeDentalImage(targetImage.base64, targetImage.mimeType);
      clearInterval(progressInterval);
      setImages(prev => prev.map(img => 
        img.id === id ? { ...img, status: 'success', result: data, progress: 100 } : img
      ));
    } catch (err: any) {
      console.error(err);
      clearInterval(progressInterval);
      setImages(prev => prev.map(img => 
        img.id === id ? { ...img, status: 'error', error: "识别失败，请重试。", progress: 0 } : img
      ));
    }
  };

  const handleAnalyzeAll = () => {
    images.forEach(img => {
      if (img.status === 'idle' || img.status === 'error') {
        analyzeSingleImage(img.id);
      }
    });
  };

  const handleRemoveImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const handleResetAll = () => {
    setImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleToggleJaw = (id: string, isLower: boolean) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, manualJawOverride: isLower } : img
    ));
  };

  const handleUpdateResult = (id: string, newResult: AnalysisResult) => {
    setImages(prev => prev.map(img => {
      if (img.id === id) {
        if (img.result) {
            saveToHistory(img.file.name, img.result, newResult);
        }
        return { ...img, result: newResult, isCorrected: true };
      }
      return img;
    }));
  };

  const handleBatchExport = async () => {
    const successImages = images.filter(img => img.status === 'success' && img.result);
    if (successImages.length === 0) return;

    setIsExporting(true);

    try {
      const ExcelJSModule = await import('exceljs');
      const Excel = ExcelJSModule.default || ExcelJSModule;
      
      if (!Excel || !Excel.Workbook) {
        throw new Error("Failed to load ExcelJS module correctly.");
      }

      const workbook = new Excel.Workbook();
      const worksheet = workbook.addWorksheet('识别结果');

      worksheet.columns = [
        { header: '原图片', key: 'image', width: 20 },
        { header: '原图片名称', key: 'name', width: 30 },
        { header: '牙位描述', key: 'description', width: 60 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

      for (let i = 0; i < successImages.length; i++) {
        const img = successImages[i];
        if (!img.result) continue;

        let description = generateCombinedDescription(img.result.findings);

        if (!img.isCorrected && img.result.missingHorizontalLine && img.manualJawOverride) {
            description = description
            .replace(/右上/g, '右下')
            .replace(/左上/g, '左下')
            .replace(/上颌/g, '下颌');
        }

        description = description.trim();

        const row = worksheet.addRow({
          name: img.file.name,
          description: description
        });

        row.alignment = { vertical: 'middle', wrapText: true };
        row.height = 100;

        let ext = 'png';
        if (img.mimeType.includes('jpeg') || img.mimeType.includes('jpg')) ext = 'jpeg';
        else if (img.mimeType.includes('gif')) ext = 'gif';
        
        const imageId = workbook.addImage({
          base64: img.base64,
          extension: ext as any,
        });

        worksheet.addImage(imageId, {
          tl: { col: 0, row: row.number - 1 },
          br: { col: 1, row: row.number },
          editAs: 'oneCell'
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `牙位识别结果_${new Date().toLocaleDateString().replace(/\//g, '-')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error: any) {
      console.error("Export Excel failed", error);
      alert(`导出 Excel 失败: ${error.message || "请检查浏览器兼容性"}`);
    } finally {
      setIsExporting(false);
    }
  };

  const isAnyAnalyzing = images.some(img => img.status === 'analyzing');
  const hasSuccessImages = images.some(img => img.status === 'success');
  const hasHistory = getHistory().length > 0;

  return (
    <div className="animate-fade-in-up">
      {/* Action Bar & Upload Area */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-white hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group bg-white/60"
          >
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-gray-900">本地图片上传</h3>
            <p className="text-xs text-gray-500 mt-1">支持多选 (PNG, JPG, WEBP)</p>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              multiple
              className="hidden" 
              onChange={handleFileSelect}
            />
          </div>

          <div 
            onClick={() => setShowUrlModal(true)}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-white hover:border-indigo-500 hover:shadow-md transition-all cursor-pointer group bg-white/60"
          >
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
              </svg>
            </div>
            <h3 className="text-base font-medium text-gray-900">通过链接导入</h3>
            <p className="text-xs text-gray-500 mt-1">支持 CDN 链接批量导入</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-4 rounded-xl shadow-sm border border-gray-200">
           <div className="flex items-center gap-4">
             <span className="text-sm text-gray-600 font-medium">已选择 {images.length} 张图片</span>
             {hasHistory && (
               <button 
                 onClick={exportHistoryDataset}
                 className="text-xs text-amber-600 hover:text-amber-700 underline flex items-center gap-1"
                 title="导出包含原始识别和人工纠错的JSON数据"
               >
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                   <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.965 3.129V2.75z" />
                   <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                 </svg>
                 导出训练数据集 (JSON)
               </button>
             )}
           </div>

            <div className="flex gap-2 flex-wrap">
               <button 
                onClick={handleResetAll}
                disabled={isAnyAnalyzing || isExporting}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                清空
              </button>
              <button 
                onClick={handleBatchExport}
                disabled={!hasSuccessImages || isAnyAnalyzing || isExporting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition-all ${
                  !hasSuccessImages || isAnyAnalyzing || isExporting
                    ? 'bg-green-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 hover:shadow'
                }`}
              >
                {isExporting ? (
                   <><svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>打包中...</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>导出结果 (Excel)</>
                )}
              </button>
              <button 
                onClick={handleAnalyzeAll}
                disabled={isAnyAnalyzing || images.every(i => i.status === 'success') || isExporting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition-all ${
                  isAnyAnalyzing || images.every(i => i.status === 'success') || isExporting
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow'
                }`}
              >
                {isAnyAnalyzing ? '正在处理...' : '批量识别'}
              </button>
            </div>
        </div>
      </div>

      {/* URL Import Modal */}
      {showUrlModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-fade-in-up">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">批量导入图片链接</h3>
              <button onClick={() => setShowUrlModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              <textarea
                className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-mono"
                placeholder={`https://example.com/image1.png\nhttps://example.com/image2.jpg`}
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-500">
                每行一个链接。注意：图片链接必须支持跨域访问 (CORS)，否则无法加载。
              </p>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button 
                onClick={() => setShowUrlModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleUrlSubmit}
                disabled={isImportingUrls || !urlInput.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isImportingUrls ? '下载中...' : '导入列表'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image List */}
      <div className="space-y-6 mt-8">
        {images.map((img) => (
          <div key={img.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
            <div className="p-4 flex flex-col sm:flex-row gap-5">
              {/* Thumbnail */}
              <div className="relative group w-full sm:w-48 h-48 flex-shrink-0 bg-gray-100 rounded-lg border border-gray-200 overflow-hidden flex items-center justify-center">
                {img.previewUrl ? (
                  <img 
                    src={img.previewUrl} 
                    alt="Dental Upload" 
                    className="w-full h-full object-contain p-2"
                  />
                ) : (
                  <div className="text-gray-400 text-xs text-center p-2">无法预览</div>
                )}
                {img.status === 'success' && (
                   <div className={`absolute top-2 right-2 text-white p-1 rounded-full shadow-md ${img.isCorrected ? 'bg-amber-500' : 'bg-green-500'}`}>
                      {img.isCorrected ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                        </svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                        </svg>
                      )}
                   </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-gray-900 truncate pr-4" title={img.file.name}>{img.file.name}</h4>
                    <button 
                      onClick={() => handleRemoveImage(img.id)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                      title="删除"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-4">
                    {img.status !== 'error' && `大小: ${(img.file.size / 1024).toFixed(0)} KB • `} 类型: {img.file.type.split('/')[1]?.toUpperCase() || 'UNKNOWN'}
                  </div>
                </div>

                {/* Status & Controls */}
                <div>
                  {img.status === 'analyzing' && (
                    <div className="space-y-2 mb-2">
                       <div className="flex justify-between text-xs text-blue-600 font-medium">
                         <span>正在分析中...</span>
                         <span>{img.progress}%</span>
                       </div>
                       <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                         <div 
                           className="bg-blue-600 h-2 rounded-full transition-all duration-500 ease-out"
                           style={{ width: `${img.progress}%` }}
                         ></div>
                       </div>
                    </div>
                  )}

                  {img.status === 'error' && (
                    <div className="mb-3 text-sm text-red-600 bg-red-50 border border-red-100 p-2 rounded flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0">
                         <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                      </svg>
                      <span className="truncate">{img.error}</span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {img.status !== 'analyzing' && img.status !== 'success' && (
                      <button 
                        onClick={() => analyzeSingleImage(img.id)}
                        disabled={img.status === 'error'}
                        className={`border border-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm ${
                          img.status === 'error' 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'bg-white text-gray-700 hover:border-blue-500 hover:text-blue-600'
                        }`}
                      >
                        {img.status === 'error' ? '无法识别' : '开始识别'}
                      </button>
                    )}
                    {img.status === 'success' && (
                       <div className={`flex items-center gap-2 text-sm font-medium px-1 ${img.isCorrected ? 'text-amber-600' : 'text-green-600'}`}>
                         {img.isCorrected ? (
                           <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                              <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                            </svg>
                            已人工修正
                           </>
                         ) : (
                           <>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                            </svg>
                            识别完成
                           </>
                         )}
                       </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Result Section */}
            {img.status === 'success' && img.result && (
              <div className="border-t border-gray-100 bg-gray-50/50 p-4 sm:p-6">
                <ResultCard 
                  result={img.result} 
                  manualJawOverride={img.manualJawOverride}
                  onToggleJaw={(isLower) => handleToggleJaw(img.id, isLower)}
                  onUpdateResult={(newResult) => handleUpdateResult(img.id, newResult)}
                />
              </div>
            )}
          </div>
        ))}
        
        {images.length === 0 && (
           <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-200 text-gray-400">
             暂无图片，请点击上方区域上传。
           </div>
        )}
      </div>
    </div>
  );
};