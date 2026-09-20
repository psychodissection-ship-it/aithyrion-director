import React, { useState, useEffect } from 'react';
import { JevInspectorTelemetry } from '../types/director';
import { JevDirectorEngine } from '../services/engine/JevDirectorEngine';
import { Terminal, Shield, RefreshCw, X, Radio, Clock, Sliders, CheckCircle2, AlertTriangle } from 'lucide-react';

interface JevInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  jevEngine: JevDirectorEngine;
}

export const JevInspectorModal: React.FC<JevInspectorModalProps> = ({
  isOpen,
  onClose,
  jevEngine,
}) => {
  const [telemetry, setTelemetry] = useState<JevInspectorTelemetry | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchTelemetry = async () => {
    setLoading(true);
    try {
      const data = await jevEngine.getInspectorTelemetry();
      setTelemetry(data);
    } catch (err) {
      console.error('Failed to fetch telemetry:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchTelemetry();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none font-mono">
      <div className="bg-surface-850 border border-surface-700/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="border-b border-surface-750 px-6 py-4 flex items-center justify-between bg-surface-900">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Raw JEV Request / Response Inspector
                </h3>
                {telemetry && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                      telemetry.mode === 'LIVE_REMOTE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {telemetry.mode}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Live inspect raw network payload sent to JEV neural backend (Zero secrets exposed)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={fetchTelemetry}
              disabled={loading}
              aria-label="テレメトリを更新"
              className="p-2 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-400 hover:text-white transition border border-surface-700"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              aria-label="閉じる"
              className="p-2 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-400 hover:text-white transition border border-surface-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
          {!telemetry || (telemetry as any).status === 'NO_ACTIVITY' ? (
            <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center">
              <Terminal className="w-8 h-8 mb-2 opacity-40" />
              <span>No active JEV requests captured yet.</span>
              <span className="text-[11px] text-slate-600 mt-1">
                Execute a timeline point or benchmark with JevDirectorEngine to inspect raw network telemetry.
              </span>
            </div>
          ) : (
            <>
              {/* Meta Info Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface-900 p-3 rounded-xl border border-surface-750 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px]">Target Endpoint</span>
                  <span className="text-slate-200 font-semibold truncate block mt-0.5" title={telemetry.endpoint}>
                    {telemetry.endpoint || 'http://localhost:5180'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Roundtrip Latency</span>
                  <span className="text-purple-400 font-bold block mt-0.5">
                    {telemetry.latencyMs} ms
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Security Clearance</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                    <Shield className="w-3 h-3" /> Sanitized
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Timestamp</span>
                  <span className="text-slate-400 block mt-0.5">
                    {new Date(telemetry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

              {/* 1. Request State */}
              <div className="bg-surface-900 border border-surface-750 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 border-b border-surface-800 mb-2.5">
                  <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-indigo-400" />
                    1. Request Music State (JSON Payload)
                  </span>
                  <span className="text-[10px] text-slate-500">Sent to /v1/director/pass1</span>
                </div>
                <pre className="text-indigo-300 text-[11px] bg-surface-850 p-3 rounded-lg overflow-x-auto leading-relaxed border border-surface-800">
                  {JSON.stringify(telemetry.requestState, null, 2)}
                </pre>
              </div>

              {/* 2. Request Questions */}
              <div className="bg-surface-900 border border-surface-750 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 border-b border-surface-800 mb-2.5">
                  <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    2. Request Structured Prompt Questions
                  </span>
                  <span className="text-[10px] text-slate-500">Neural prompt structure</span>
                </div>
                <div className="space-y-2">
                  {telemetry.requestQuestions.map((q, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-850 p-2.5 rounded-lg border border-surface-800 text-slate-300 text-[11px]"
                    >
                      {q}
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Raw Response & Probabilities */}
              <div className="bg-surface-900 border border-surface-750 rounded-xl p-4">
                <div className="flex items-center justify-between pb-2 border-b border-surface-800 mb-2.5">
                  <span className="font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    3. Raw JEV Response & Probability Distribution
                  </span>
                  <span className="text-emerald-400 font-bold">
                    Confidence: {(telemetry.response.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Primary Decision Banner */}
                <div className="bg-surface-850 p-3 rounded-lg border border-surface-800 flex items-center justify-between mb-3">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Selected Directorial Option</span>
                    <span className="text-base font-bold text-white mt-0.5 block">
                      {telemetry.response.selected_option}
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                    Primary Choice
                  </span>
                </div>

                {/* Probability Bars */}
                <div className="space-y-2.5 bg-surface-850 p-3 rounded-lg border border-surface-800">
                  <span className="text-[10.5px] text-slate-400 font-semibold block mb-1">
                    Raw Probability Tensor Distribution:
                  </span>
                  {Object.entries(telemetry.response.probabilities).map(([strat, prob]) => {
                    const probPct = Math.round(prob * 100);
                    return (
                      <div key={strat} className="space-y-1">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-300">{strat}</span>
                          <span className="text-indigo-400 font-bold">{probPct}%</span>
                        </div>
                        <div className="w-full bg-surface-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all"
                            style={{ width: `${probPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Diagnostic Scores if present */}
                {telemetry.response.diagnostic && (
                  <div className="mt-3 bg-surface-850 p-3 rounded-lg border border-amber-500/30">
                    <span className="text-amber-400 font-semibold text-[11px] block mb-1.5">
                      Diagnostic Pass Metrics:
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-surface-900 p-2 rounded">
                        <span className="text-[9.5px] text-slate-500 block">Impact Arrival</span>
                        <span className="text-white font-bold">{telemetry.response.diagnostic.impact_arrival}</span>
                      </div>
                      <div className="bg-surface-900 p-2 rounded ring-1 ring-amber-500/30">
                        <span className="text-[9.5px] text-amber-400 block">Tension Should Continue</span>
                        <span className="text-amber-300 font-bold">{telemetry.response.diagnostic.tension_should_continue}</span>
                      </div>
                      <div className="bg-surface-900 p-2 rounded">
                        <span className="text-[9.5px] text-slate-500 block">Release Appropriate</span>
                        <span className="text-white font-bold">{telemetry.response.diagnostic.release_is_appropriate}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-surface-750 px-6 py-3 bg-surface-900 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1 text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
            <span>Authorization header and API keys omitted from client inspection.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
