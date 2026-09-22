import React from 'react';
import {
  Layers,
  Search,
  CheckSquare,
  BarChart3,
  Sliders,
  Play,
  RotateCw,
  FlaskConical,
  Activity
} from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  mode: 'mock' | 'live';
  onOpenSettings: () => void;
  onQuickRunP1: () => void;
  isOperating: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onSelectTab,
  mode,
  onOpenSettings,
  onQuickRunP1,
  isOperating
}) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'candidates', label: 'Candidates', icon: CheckSquare },
    { id: 'posts', label: 'Raw Posts', icon: Search },
    { id: 'queries', label: 'Query Matrix', icon: Layers },
    { id: 'analytics_queries', label: 'Query Precision', icon: BarChart3 },
    { id: 'analytics_feedback', label: 'Score Calibration', icon: FlaskConical }
  ];

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
        {/* Left: Brand & Mode Badge */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="font-bold tracking-tight text-white flex items-center text-sm md:text-base">
              <span className="text-sky-400 mr-1.5 font-mono">𝕏</span> Game Discovery Lab
            </span>
            <span className="text-xs text-slate-400 font-mono bg-slate-800 px-1.5 py-0.5 rounded">
              v0.1
            </span>
          </div>

          <div
            onClick={onOpenSettings}
            className={`cursor-pointer px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider flex items-center space-x-1.5 transition-colors ${
              mode === 'live'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
            }`}
            title="Click to view mode details & settings"
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                mode === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{mode === 'live' ? 'LIVE X API' : 'MOCK DATA MODE'}</span>
          </div>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center space-x-1.5 transition-all whitespace-nowrap ${
                  active
                    ? 'bg-slate-800 text-white shadow-sm border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Quick Actions & Settings */}
        <div className="flex items-center space-x-2">
          <button
            id="btn-quick-run-p1"
            onClick={onQuickRunP1}
            disabled={isOperating}
            className="hidden sm:inline-flex items-center space-x-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-medium px-2.5 py-1.5 rounded-md shadow transition-colors"
            title="Execute all P1 Release & Browser queries"
          >
            {isOperating ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>Run All P1</span>
          </button>

          <button
            id="btn-open-settings"
            onClick={onOpenSettings}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
            title="Settings, Data Mode & CSV Export"
          >
            <Sliders className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex overflow-x-auto border-t border-slate-800 px-2 py-1 space-x-1 scrollbar-none">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1 whitespace-nowrap ${
                active ? 'bg-slate-800 text-white' : 'text-slate-400'
              }`}
            >
              <Icon className="w-3 h-3" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
