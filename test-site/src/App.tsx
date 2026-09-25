import { useState } from 'react';
import { Header } from './components/Header';
import { HeroPanel } from './components/HeroPanel';
import { WsStressPanel } from './components/WsStressPanel';
import { SceneGraphPanel } from './components/SceneGraphPanel';
import { LwwPanel } from './components/LwwPanel';
import { TailwindPanel } from './components/TailwindPanel';
import { HistoryPanel } from './components/HistoryPanel';
import { PerfBenchPanel } from './components/PerfBenchPanel';
import { Footer } from './components/Footer';
import './App.css';

export type Tab = 'ws' | 'scene' | 'lww' | 'tailwind' | 'history' | 'bench';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('ws');

  return (
    <div className="app">
      <Header />
      <main className="main">
        <div className="container">
          <HeroPanel />

          <nav className="tabs" role="tablist" aria-label="Test panels">
            {([
              ['ws',       '⚡ WS Stress'],
              ['scene',    '🔍 SceneGraph'],
              ['lww',      '⚖️  LWW Queue'],
              ['tailwind', '🎨 Tailwind'],
              ['history',  '⏳ History'],
              ['bench',    '🚀 Perf Bench'],
            ] as [Tab, string][]).map(([id, label]) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={activeTab === id}
                aria-controls={`panel-${id}`}
                className={`tab-btn ${activeTab === id ? 'tab-btn--active' : ''}`}
                onClick={() => setActiveTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="panel-area">
            {activeTab === 'ws'       && <WsStressPanel />}
            {activeTab === 'scene'    && <SceneGraphPanel />}
            {activeTab === 'lww'      && <LwwPanel />}
            {activeTab === 'tailwind' && <TailwindPanel />}
            {activeTab === 'history'  && <HistoryPanel />}
            {activeTab === 'bench'    && <PerfBenchPanel />}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
