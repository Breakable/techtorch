'use client';

import { useState } from 'react';

interface Mission {
  id: string;
  label: string;
  description: string;
  query: string;
}

const PREDEFINED_MISSIONS: Mission[] = [
  {
    id: 'acme-billing',
    label: 'Investigate ACME Corp Billing',
    description: 'Check ACME Corp (C-1001) for missing invoices and anomalies',
    query: 'Investigate plan C-1001 for ACME Corp. Check for missing invoices, overbilling, or any billing anomalies.',
  },
  {
    id: 'missing-invoices',
    label: 'Find Missing Invoices',
    description: 'Scan all plans for missing invoices based on cadence',
    query: 'Analyze all billing plans and find any missing invoices. Check each plan\'s cadence and verify all expected invoices are present.',
  },
  {
    id: 'currency-errors',
    label: 'Check Currency Conversions',
    description: 'Verify FX conversions are correct',
    query: 'Check all invoices for currency conversion errors. Verify EUR to USD conversions using the correct exchange rates.',
  },
  {
    id: 'orphan-invoices',
    label: 'Identify Orphan Invoices',
    description: 'Find invoices without valid plan references',
    query: 'Find all orphan invoices - invoices that have no plan_id or reference invalid plans.',
  },
  {
    id: 'globex-investigation',
    label: 'Investigate Globex Ltd',
    description: 'Review Globex Ltd billing and amendments',
    query: 'Investigate Globex Ltd billing. Check plan C-1007 and its amendments for any anomalies or discrepancies.',
  },
  {
    id: 'overbilling-check',
    label: 'Detect Overbilling',
    description: 'Find invoices exceeding plan values',
    query: 'Check all invoices for overbilling. Find any invoices where the amount exceeds what should be charged based on the plan.',
  },
];

interface MissionSelectorProps {
  onMissionStart?: (query: string) => Promise<void>;
}

export default function MissionSelector({ onMissionStart }: MissionSelectorProps) {
  const [selectedMission, setSelectedMission] = useState<string>('');
  const [customQuery, setCustomQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMissionClick = async (mission: Mission) => {
    if (!onMissionStart || isSubmitting) return;

    setSelectedMission(mission.id);
    setIsSubmitting(true);

    try {
      await onMissionStart(mission.query);
    } catch (error) {
      console.error('Mission error:', error);
    } finally {
      setIsSubmitting(false);
      setSelectedMission('');
    }
  };

  const handleCustomSubmit = async () => {
    if (!customQuery.trim() || !onMissionStart || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onMissionStart(customQuery);
      setCustomQuery('');
    } catch (error) {
      console.error('Custom query error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200">
        <h2 className="text-xl font-semibold text-slate-900">Quick Missions</h2>
        <p className="text-sm text-slate-600 mt-1">
          Start predefined investigations
        </p>
      </div>

      {/* Mission Buttons */}
      <div className="p-6 space-y-3">
        {PREDEFINED_MISSIONS.map((mission) => (
          <button
            key={mission.id}
            onClick={() => handleMissionClick(mission)}
            disabled={isSubmitting}
            className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
              selectedMission === mission.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 text-sm">
                  {mission.label}
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  {mission.description}
                </p>
              </div>
              {selectedMission === mission.id ? (
                <svg className="animate-spin h-5 w-5 text-blue-600 ml-3 flex-shrink-0" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5 text-slate-400 ml-3 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="px-6">
        <div className="border-t border-slate-200" />
      </div>

      {/* Info Box */}
      <div className="px-6 pb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg
              className="h-5 w-5 text-blue-600 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="ml-3">
              <p className="text-xs text-blue-800">
                <span className="font-semibold">Tip:</span> Click a mission to automatically start an investigation with predefined parameters.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}