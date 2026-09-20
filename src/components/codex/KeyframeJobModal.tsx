import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileCode,
  Terminal,
  Copy,
  Check,
  Sparkles,
  Layers,
  Image as ImageIcon,
  ExternalLink,
  ShieldAlert,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { KeyframeJob, CodexCliStatus } from '../../types/codexBridge';

interface KeyframeJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: KeyframeJob | null;
  cliStatus: CodexCliStatus | null;
  onOpenReview: () => void;
}

export const KeyframeJobModal: React.FC<KeyframeJobModalProps> = ({
  isOpen,
  onClose,
  job,
  cliStatus,
  onOpenReview,
}) => {
  const [activeTab, setActiveTab] = useState<'TASK_MD' | 'CLI_CMD' | 'EXECUTE' | 'JOB_JSON'>('TASK_MD');
  const [copied, setCopied] = useState<string | null>(null);

  // Execution states
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [executionStatus, setExecutionStatus] = useState<'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [executionError, setExecutionError] = useState<string | null>(null);
  const logTerminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight;
    }
  }, [executionLogs]);

  // Reset or initialize when modal opens or job changes
  useEffect(() => {
    if (!isOpen || !job) {
      setExecutionLogs([]);
      setExecutionStatus('IDLE');
      setIsExecuting(false);
      setExecutionError(null);
      return;
    }

    // Check if task is already running/completed on server
    fetch(`/api/codex/task-status?jobId=${job.job_id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data && data.status && data.status !== 'IDLE') {
          setExecutionStatus(data.status);
          setExecutionLogs(data.logs || []);
          if (data.status === 'RUNNING') {
            setIsExecuting(true);
            setActiveTab('EXECUTE');
          }
        }
      })
      .catch(() => {});
  }, [isOpen, job?.job_id]);

  // Polling during execution — with isMounted guard to prevent state updates on unmounted component (C-8 fix)
  useEffect(() => {
    if (!isExecuting || !job) return;
    let isMounted = true;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/codex/task-status?jobId=${job.job_id}`);
        if (!res.ok || !isMounted) return;
        const data = await res.json();
        if (!isMounted) return;
        if (data.logs) {
          setExecutionLogs(data.logs);
        }
        if (data.status === 'COMPLETED') {
          setIsExecuting(false);
          setExecutionStatus('COMPLETED');
          clearInterval(interval);
        } else if (data.status === 'FAILED') {
          setIsExecuting(false);
          setExecutionStatus('FAILED');
          setExecutionError(data.error || 'Execution failed');
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isExecuting, job?.job_id]);

  if (!isOpen || !job) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleStartCodexExecution = async () => {
    if (!job) return;
    setIsExecuting(true);
    setExecutionStatus('RUNNING');
    setExecutionError(null);
    setExecutionLogs([`[Aithyrion Director] Requesting Codex execution for ${job.job_id}...`]);
    setActiveTab('EXECUTE');

    try {
      const res = await fetch('/api/codex/execute-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.job_id }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start execution');
      }
    } catch (err: any) {
      setIsExecuting(false);
      setExecutionStatus('FAILED');
      setExecutionError(err.message);
      setExecutionLogs((prev) => [...prev, `[Error] ${err.message}`]);
    }
  };

  const isCliAvailable = cliStatus?.available;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-850 border border-surface-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden font-mono text-slate-200 animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-700/60 bg-surface-900/80">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-semibold text-white tracking-wide">
                  Codex Keyframe Job ({job.job_id})
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {job.status}
                </span>
                {executionStatus === 'RUNNING' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>CODEX RUNNING</span>
                  </span>
                )}
                {executionStatus === 'COMPLETED' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center space-x-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>CODEX FINISHED</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Shot #{job.timeline.shot_index} • {job.timeline.start_sec.toFixed(2)}s &rarr;{' '}
                {job.timeline.end_sec.toFixed(2)}s ({job.timeline.duration_sec.toFixed(2)}s)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="閉じる"
            className="p-1 rounded-lg hover:bg-surface-750 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Bridge Mode Banner & Tab Switcher */}
        <div className="px-6 py-2.5 bg-surface-900 border-b border-surface-750 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <ShieldAlert
              className={`w-4 h-4 ${isCliAvailable ? 'text-emerald-400' : 'text-amber-400'}`}
            />
            <span className="text-slate-400 text-[11px]">Bridge:</span>
            <span
              className={`font-semibold px-2 py-0.5 rounded text-[10.5px] ${
                isCliAvailable
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}
            >
              {cliStatus?.mode || 'MANUAL_HANDOFF'}
            </span>
            <span className="text-slate-500 text-[11px] hidden sm:inline">({cliStatus?.message})</span>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => setActiveTab('EXECUTE')}
              className={`px-3 py-1 rounded-lg text-xs transition flex items-center space-x-1.5 ${
                activeTab === 'EXECUTE'
                  ? 'bg-emerald-600 text-white font-semibold'
                  : 'bg-surface-800 text-slate-300 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Codex Console</span>
            </button>
            <button
              onClick={() => setActiveTab('TASK_MD')}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                activeTab === 'TASK_MD'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-surface-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Task ($imagegen)
            </button>
            <button
              onClick={() => setActiveTab('CLI_CMD')}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                activeTab === 'CLI_CMD'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-surface-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              CLI Cmd
            </button>
            <button
              onClick={() => setActiveTab('JOB_JSON')}
              className={`px-3 py-1 rounded-lg text-xs transition ${
                activeTab === 'JOB_JSON'
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-surface-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              Spec JSON
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs font-mono">
          {/* TAB 0: EXECUTE CODEX / LIVE CONSOLE */}
          {activeTab === 'EXECUTE' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-200 font-bold flex items-center space-x-2">
                    <span>Direct Codex CLI Execution Engine</span>
                    {isCliAvailable && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px]">
                        Detected: {cliStatus?.version}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Spawns local Codex CLI non-interactively with reference inputs (-i) and task markdown
                  </div>
                </div>

                {/* Primary Action Button */}
                <button
                  onClick={handleStartCodexExecution}
                  disabled={!isCliAvailable || isExecuting}
                  className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl font-bold shadow-lg transition ${
                    isExecuting
                      ? 'bg-amber-600/50 text-amber-200 cursor-not-allowed'
                      : !isCliAvailable
                      ? 'bg-surface-800 text-slate-500 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                  }`}
                >
                  {isExecuting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Executing in Codex...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Run in Codex</span>
                    </>
                  )}
                </button>
              </div>

              {/* Console Output Box */}
              <div
                ref={logTerminalRef}
                className="bg-surface-950 p-4 rounded-xl border border-surface-750 font-mono text-[11px] text-emerald-400 h-64 overflow-y-auto leading-relaxed shadow-inner"
              >
                {executionLogs.length === 0 ? (
                  <div className="text-slate-500 italic">
                    Ready to execute. Click "Run in Codex" to trigger the local Codex worker...
                  </div>
                ) : (
                  executionLogs.map((log, idx) => (
                    <div key={idx} className="whitespace-pre-wrap">
                      {log}
                    </div>
                  ))
                )}
              </div>

              {/* Status Banner when completed */}
              {executionStatus === 'COMPLETED' && (
                <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Codex execution completed! Proceed to Human Review & Continuity Approval.</span>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenReview();
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold shadow transition text-xs"
                  >
                    Open Review
                  </button>
                </div>
              )}

              {executionStatus === 'FAILED' && (
                <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>Execution failed: {executionError}</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 1: TASK MARKDOWN */}
          {activeTab === 'TASK_MD' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-slate-400">
                  Target File: <code className="text-indigo-300">codex_tasks/{job.job_id}.md</code>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(job.codex_task_markdown || '', 'Task Markdown copied')
                  }
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-800 hover:bg-surface-750 text-slate-200 border border-surface-700 transition"
                >
                  {copied === 'Task Markdown copied' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Task Markdown</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-surface-950 p-4 rounded-xl border border-surface-750 overflow-x-auto text-slate-300 text-[11.5px] leading-relaxed whitespace-pre-wrap selection:bg-indigo-600 max-h-96">
                {job.codex_task_markdown}
              </div>
            </div>
          )}

          {/* TAB 2: CLI LAUNCH COMMAND */}
          {activeTab === 'CLI_CMD' && (
            <div className="space-y-4">
              <div className="p-3 bg-surface-900 rounded-xl border border-surface-750 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-semibold flex items-center space-x-1.5">
                    <Terminal className="w-4 h-4 text-indigo-400" />
                    <span>PowerShell / Command Prompt</span>
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(job.cli_launch_command || '', 'Command copied')
                    }
                    className="flex items-center space-x-1 px-2 py-0.5 rounded bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 transition"
                  >
                    {copied === 'Command copied' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copied === 'Command copied' ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
                <div className="p-2.5 bg-surface-950 rounded-lg text-amber-300 text-[11px] overflow-x-auto break-all">
                  {job.cli_launch_command}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 bg-surface-800/40 p-3 rounded-lg border border-surface-700/50">
                <div className="font-semibold text-slate-300">Reference Flags Included:</div>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                  <li>
                    Identity: <code>{job.subject.identity_reference}</code>
                  </li>
                  {job.continuity.previous_keyframe && (
                    <li>
                      Continuity: <code>{job.continuity.previous_keyframe}</code>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: JOB JSON */}
          {activeTab === 'JOB_JSON' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-slate-400">
                  File: <code className="text-indigo-300">keyframe_jobs/pending/{job.job_id}.json</code>
                </div>
                <button
                  onClick={() =>
                    copyToClipboard(JSON.stringify(job, null, 2), 'JSON copied')
                  }
                  className="flex items-center space-x-1 px-2.5 py-1 rounded bg-surface-800 hover:bg-surface-750 text-slate-200 border border-surface-700 transition"
                >
                  {copied === 'JSON copied' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copied === 'JSON copied' ? 'Copied!' : 'Copy JSON'}</span>
                </button>
              </div>

              <pre className="bg-surface-950 p-4 rounded-xl border border-surface-750 overflow-x-auto text-emerald-400 text-[11px] max-h-96">
                {JSON.stringify(job, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-surface-700/60 bg-surface-900/80 flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-500">
            Codex handles $imagegen • Director manages continuity
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-surface-800 hover:bg-surface-750 text-slate-300 border border-surface-700 transition"
            >
              Close
            </button>
            <button
              onClick={() => {
                onClose();
                onOpenReview();
              }}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow transition"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Review Keyframe</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
