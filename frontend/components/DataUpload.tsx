"use client";

import { useState, useCallback, useRef } from "react";

const DATASETS = [
  {
    id: "simpsons-paradox",
    icon: "⚖️",
    name: "Simpson's Paradox",
    desc: "A/B test where treatment appears worse overall — but wins in every segment.",
    tags: ["A/B Test", "Causality"],
    color: "from-amber-500 to-orange-600",
  },
  {
    id: "startup-metrics",
    icon: "📈",
    name: "Startup Metrics",
    desc: "18 months of SaaS data with churn spikes and a genuine PMF signal.",
    tags: ["SaaS", "Time Series"],
    color: "from-emerald-500 to-teal-600",
  },
  {
    id: "clinical-trial",
    icon: "🧬",
    name: "Clinical Trial",
    desc: "Phase III RCT: 2 real effects, 3 spurious, and a multiple-testing trap.",
    tags: ["Clinical", "FDR"],
    color: "from-rose-500 to-pink-600",
  },
  {
    id: "feature-drift",
    icon: "📉",
    name: "Feature Drift",
    desc: "90 days of ML monitoring: gradual drift, a pipeline bug, seasonal pattern.",
    tags: ["ML Ops", "Drift"],
    color: "from-blue-500 to-cyan-600",
  },
  {
    id: "grokking",
    icon: "🧠",
    name: "Grokking Detection",
    desc: "Transformer training with phase transitions and attention specialization.",
    tags: ["ML", "Temporal"],
    color: "from-violet-500 to-purple-600",
  },
];

interface DataUploadProps {
  onUpload: (files: File[]) => void;
  onDemoDataset: (id: string) => void;
  disabled?: boolean;
}

export default function DataUpload({ onUpload, onDemoDataset, disabled }: DataUploadProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(f =>
      /\.(csv|json|yaml|tsv|txt)$/i.test(f.name)
    );
    if (files.length) onUpload(files);
  }, [disabled, onUpload]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onUpload(Array.from(e.target.files));
  }, [onUpload]);

  return (
    <div className="stack" style={{ gap: 32 }}>
      {/* Glassmorphism Upload Zone */}
      <div
        className={`upload-zone glass ${dragging ? "dragging" : ""} ${disabled ? "disabled" : ""}`}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setDragging(false); }}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        {/* Animated Icon */}
        <div className="relative mb-4">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${dragging ? 'from-emerald-500 to-teal-600' : 'from-indigo-500 to-purple-600'} 
            flex items-center justify-center text-2xl shadow-lg transition-all duration-300
            ${dragging ? 'scale-110' : 'hover:scale-105'}`}
            style={{
              boxShadow: dragging 
                ? '0 0 40px rgba(16, 185, 129, 0.4)' 
                : '0 8px 32px rgba(99, 102, 241, 0.3)'
            }}
          >
            {dragging ? "↓" : "↑"}
          </div>
          {/* Ripple effect on hover */}
          <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-gradient-to-br from-indigo-500 to-purple-600" />
        </div>

        <p className="font-semibold text-lg text-white mb-2">
          {dragging ? "Release to upload" : "Drop your dataset"}
        </p>
        <p className="text-sm text-zinc-500 mb-6">
          Drag & drop CSV, JSON, TSV, TXT — or click to browse
        </p>

        <button
          className="btn btn-primary"
          onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
          disabled={disabled}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Select files
        </button>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".csv,.json,.yaml,.toml,.tsv,.txt"
          onChange={handleChange}
          disabled={disabled}
          style={{ display: "none" }}
        />

        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[20px]">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-3xl" />
        </div>
      </div>

      {/* Divider with glow */}
      <div className="divider">
        <span className="text-gradient">or explore demo datasets</span>
      </div>

      {/* Demo datasets with glassmorphism cards */}
      <div className="grid-3">
        {DATASETS.map((ds, index) => (
          <button
            key={ds.id}
            className="glass-card-interactive text-left group"
            onClick={() => onDemoDataset(ds.id)}
            disabled={disabled}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Gradient accent bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${ds.color} rounded-t-[14px] mb-4 opacity-0 group-hover:opacity-100 transition-opacity`} />

            <div className="row mb-3">
              <span className="text-2xl filter group-hover:scale-110 transition-transform duration-300">{ds.icon}</span>
              <span className="font-semibold text-white text-[15px]">{ds.name}</span>
            </div>

            <p className="text-sm text-zinc-400 mb-4 line-clamp-2 leading-relaxed">
              {ds.desc}
            </p>

            <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
              {ds.tags.map(t => (
                <span key={t} className="badge badge-tag">{t}</span>
              ))}
            </div>

            {/* Hover glow effect */}
            <div className={`absolute inset-0 rounded-[14px] bg-gradient-to-br ${ds.color} opacity-0 group-hover:opacity-5 transition-opacity pointer-events-none`} />
          </button>
        ))}
      </div>

      {/* Feature highlights */}
      <div className="grid-2 mt-4">
        <div className="card-elevated flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white text-sm">5-Check Skeptic Gauntlet</p>
            <p className="text-xs text-zinc-500">FDR, confounders, temporal, holdout, effect size</p>
          </div>
        </div>
        <div className="card-elevated flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-white text-sm">Surprise-First Ranking</p>
            <p className="text-xs text-zinc-500">KL divergence scores rank by unexpectedness</p>
          </div>
        </div>
      </div>
    </div>
  );
}
