import React, { useState } from 'react';
import { Header } from './components/Header';
import { ImageRecognition } from './components/ImageRecognition';
import { ChartGenerator } from './components/ChartGenerator';

function App() {
  const [activeTab, setActiveTab] = useState<'recognition' | 'generator'>('recognition');

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />

      <main className="flex-grow p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8">
        
        {/* Intro Section */}
        <div className="text-center space-y-2 mb-4">
          <h2 className="text-3xl font-bold text-gray-900">帕尔默牙位标记 AI 工具</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            集智能识别、数据校对与标准图表生成于一体的牙科辅助工具。
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center border-b border-gray-200 mb-8">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('recognition')}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'recognition' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <div className="flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                图片识别
              </div>
            </button>
            <button
              onClick={() => setActiveTab('generator')}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${activeTab === 'generator' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              <div className="flex items-center gap-2">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                牙位图制作
              </div>
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <div className="min-h-[400px]">
          {activeTab === 'recognition' ? <ImageRecognition /> : <ChartGenerator />}
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-500 mt-8">
        <p>© {new Date().getFullYear()} 牙科 AI 工具。仅供教学和辅助使用。</p>
      </footer>
    </div>
  );
}

export default App;