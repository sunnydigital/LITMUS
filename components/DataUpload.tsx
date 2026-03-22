"use client";

import React from "react";

interface DemoDataset {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color?: "accent" | "emerald" | "amber" | "purple";
}

const DEMO_DATASETS: DemoDataset[] = [
  {
    id: "simpsons-paradox",
    name: "Simpson's Paradox",
    description: "A/B test of a new checkout flow where treatment appears worse overall — but wins in every segment.",
    tags: ["A/B Test", "Causality"],
    color: "accent",
  },
  {
    id: "startup-metrics",
    name: "Startup Metrics",
    description: "18 months of SaaS growth data with churn spikes, enterprise outliers, and a genuine PMF signal.",
    tags: ["SaaS", "Time Series"],
    color: "emerald",
  },
  {
    id: "clinical-trial",
    name: "Clinical Trial",
    description: "Phase III RCT with 12 endpoints: 2 real effects, 3 spurious significances, and a multiple-testing trap.",
    tags: ["Clinical", "FDR"],
    color: "amber",
  },
  {
    id: "feature-drift",
    name: "Feature Drift",
    description: "90 days of ML model monitoring: gradual feature drift, a pipeline bug, and a seasonal pattern.",
    tags: ["ML Ops", "Drift"],
    color: "purple",
  },
  {
    id: "grokking",
    name: "Grokking Detection",
    description: "Transformer training run with phase transitions, gradient spikes, and attention head specialization.",
    tags: ["ML Training", "Temporal"],
    color: "accent",
  },
];

const DATASET_ICONS: Record<string, React.ReactElement> = {
  "simpsons-paradox": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  "startup-metrics": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  "clinical-trial": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  "feature-drift": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  "grokking": (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
};

const COLOR_MAP = {
  accent: {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    text: "text-indigo-400",
    hover: "hover:bg-indigo-500/15",
    gradient: "from-indigo-500 to-purple-500",
  },
  emerald: {
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
    hover: "hover:bg-emerald-500/15",
    gradient: "from-emerald-500 to-teal-500",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    text: "text-amber-400",
    hover: "hover:bg-amber-500/15",
    gradient: "from-amber-500 to-orange-500",
  },
  purple: {
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    text: "text-purple-400",
    hover: "hover:bg-purple-500/15",
    gradient: "from-purple-500 to-pink-500",
  },
};

interface DataUploadProps {
  onUpload: (files: File[]) => void;
  onDemo: () => void;
  onDemoDataset: (datasetId: string) => void;
  disabled?: boolean;
}

export default function DataUpload({ onUpload, onDemoDataset, disabled }: DataUploadProps) {
  return (
    <div className="w-full max-w-4xl mx-auto space-y-12">
      {/* Upload Card */}
      <div className="card-glow p-8 md:p-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20 mb-6">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-zinc-100 mb-3">Upload Your Data</h2>
          <p className="text-zinc-400 max-w-md mx-auto">
            Drop your data files here or click to browse. We support CSV, JSON, and more.
          </p>
        </div>

        <div className="relative">
          <input
            type="file"
            multiple
            accept=".csv,.json,.yaml,.toml,.tsv,.txt"
            onChange={(e) => {
              if (e.target.files) onUpload(Array.from(e.target.files));
            }}
            className="hidden"
            id="artifact-upload"
            disabled={disabled}
          />
          <label
            htmlFor="artifact-upload"
            className={`input-zone ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-4 shadow-lg" style={{ boxShadow: '0 8px 30px rgba(99, 102, 241, 0.3)' }}>
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            
            <span className="text-lg font-medium text-zinc-200 mb-2 block">
              {disabled ? "Processing..." : "Drop files here or click to browse"}
            </span>
            <span className="text-sm text-zinc-500">
              {disabled ? "Please wait" : "CSV, JSON, YAML, TOML, TSV, TXT"}
            </span>
          </label>
        </div>

        <p className="text-xs text-zinc-600 text-center mt-6">
          LITMUS will profile the data, generate hypotheses, run statistical tests, and validate findings through a 5-check skeptic gauntlet.
        </p>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 animate-fade-in-up delay-100">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
        <span className="text-sm font-medium text-zinc-500 uppercase tracking-widest">or try a demo</span>
        <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
      </div>

      {/* Demo Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up delay-200">
        {DEMO_DATASETS.map((ds, index) => {
          const colors = COLOR_MAP[ds.color as keyof typeof COLOR_MAP];
          return (
            <button
              key={ds.id}
              onClick={() => onDemoDataset(ds.id)}
              disabled={disabled}
              className={`
                card p-5 text-left group
                ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
              style={{ animationDelay: `${index * 75}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${colors.bg} flex items-center justify-center ${colors.text}`}>
                  {DATASET_ICONS[ds.id]}
                </div>
                <div className="flex flex-col gap-1.5 items-end">
                  {ds.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`text-[10px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} font-medium`}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              
              <h3 className="font-semibold text-zinc-100 mb-2 group-hover:text-white transition-colors">
                {ds.name}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed line-clamp-2">
                {ds.description}
              </p>
              
              <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${colors.text} opacity-0 group-hover:opacity-100 transition-opacity`}>
                <span>Explore</span>
                <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
