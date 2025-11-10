'use client';

import { useState } from 'react';
import ChatWidget from '@/app/components/ChatWidget';
import ProposalsTable from '@/app/components/ProposalsTable';
import MissionSelector from '@/app/components/MissionSelector';

export default function Home() {
  const [missionHandler, setMissionHandler] = useState<(query: string) => Promise<void>>();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Financial Anomaly Detection Dashboard
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            AI-powered billing reconciliation and anomaly detection
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Mission Selector */}
          <div className="lg:col-span-1">
            <MissionSelector onMissionStart={missionHandler} />
          </div>

          {/* Middle Column: Chat Widget */}
          <div className="lg:col-span-2">
            <ChatWidget onReady={({ startMission }) => setMissionHandler(() => startMission)} />
          </div>
        </div>

        {/* Bottom Section: Proposals Table */}
        <div className="mt-6">
          <ProposalsTable />
        </div>
      </main>
    </div>
  );
}
