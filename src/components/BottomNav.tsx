import React from 'react';
import { useMooStore } from '../store/useMooStore';

export const BottomNav: React.FC = () => {
  const { activeTab, setActiveTab } = useMooStore();

  const tabs = [
    {
      id: 'script' as const,
      label: 'Script',
      icon: (
        <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 3l1.912 5.885h6.19l-5.008 3.638 1.913 5.886-5.007-3.638-5.007 3.638 1.913-5.886-5.008-3.638h6.19z"></path>
        </svg>
      )
    },
    {
      id: 'voice' as const,
      label: 'Voice',
      icon: (
        <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M12 2v20M17 5v14M7 5v14M2 9v6M22 9v6"></path>
        </svg>
      )
    },
    {
      id: 'studio' as const,
      label: 'Studio',
      icon: (
        <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <rect height="14" rx="2" ry="2" width="20" x="2" y="3"></rect>
          <path d="m10 9 5 3-5 3V9z"></path>
          <line x1="2" x2="22" y1="21" y2="21"></line>
        </svg>
      )
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: (
        <svg className="w-5 h-5 mb-0.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      )
    }
  ];

  return (
    <nav className="fixed bottom-0 w-full z-50 pb-safe bg-[#131315]/95 backdrop-blur-xl border-t border-zinc-800/80">
      <div className="flex justify-around items-center h-14 max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex flex-col items-center justify-center min-w-[56px] py-1 transition-all ${
                isActive
                  ? 'text-primary scale-105 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.icon}
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
