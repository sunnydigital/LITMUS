"use client";

/**
 * DataUpload
 *
 * Upload CSV data files or select from built-in demo datasets.
 * Supports:
 * - File upload (CSV, TSV, JSON, etc.)
 * - One-click demo dataset selection
 * - Paste tabular data (auto-detect format)
 * - Discover connected data sources (virtual MCP)
 */

import { useState } from "react";

interface DemoDataset {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

const DEMO_DATASETS: DemoDataset[] = [
  {
    id: "simpsons-paradox",
    name: "Simpson's Paradox",
    description: "A/B test of a new checkout flow where treatment appears worse overall — but wins in every segment.",
    tags: ["A/B Test", "Causality"],
  },
  {
    id: "startup-metrics",
    name: "Startup Metrics",
    description: "18 months of SaaS growth data with churn spikes, enterprise outliers, and a genuine PMF signal.",
    tags: ["SaaS", "Time Series"],
  },
  {
    id: "clinical-trial",
    name: "Clinical Trial",
    description: "Phase III RCT with 12 endpoints: 2 real effects, 3 spurious significances, and a multiple-testing trap.",
    tags: ["Clinical", "FDR"],
  },
  {
    id: "feature-drift",
    name: "Feature Drift",
    description: "90 days of ML model monitoring: gradual feature drift, a pipeline bug, and a seasonal pattern.",
    tags: ["ML Ops", "Drift"],
  },
  {
    id: "grokking",
    name: "Grokking Detection",
    description: "Transformer training run with phase transitions, gradient spikes, and attention head specialization over 100 epochs.",
    tags: ["ML Training", "Temporal"],
  },
];

interface DataSource {
  id: string;
  name: string;
  description: string;
  tables: Array<{ name: string; rowCount: number; columns: Array<{ name: string; type: string }> }>;
  sourceType: string;
}

interface DataUploadProps {
  onUpload: (files: File[]) => void;
  onDemo: () => void;
  onDemoDataset: (datasetId: string) => void;
  onPastedData?: (text: string) => void;
  disabled?: boolean;
}

export default function DataUpload({ onUpload, onDemoDataset, onPastedData, disabled }: DataUploadProps) {
  const [pasteMode, setPasteMode] = useState(false);
  const [pastedText, setPastedText] = useState("");
  const [discoverMode, setDiscoverMode] = useState(false);
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loadingSources, setLoadingSources] = useState(false);
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [crossAnalysisResult, setCrossAnalysisResult] = useState<{
    hypotheses: Array<{ id: string; hypothesis: string; priority: string; datasets: string[] }>;
    commonColumns: string[];
  } | null>(null);
  const [loadingCross, setLoadingCross] = useState(false);

  async function handleDiscoverSources() {
    setLoadingSources(true);
    setDiscoverMode(true);
    try {
      const res = await fetch("/api/discover-sources");
      const data = await res.json();
      setDataSources(data.sources || []);
    } catch {
      setDataSources([]);
    } finally {
      setLoadingSources(false);
    }
  }

  async function handleCrossAnalysis() {
    if (selectedSources.size < 2) return;
    setLoadingCross(true);
    try {
      const res = await fetch("/api/discover-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetIds: Array.from(selectedSources) }),
      });
      const data = await res.json();
      setCrossAnalysisResult(data);
    } catch {
      setCrossAnalysisResult(null);
    } finally {
      setLoadingCross(false);
    }
  }

  function handleSubmitPaste() {
    if (!pastedText.trim()) return;
    if (onPastedData) {
      onPastedData(pastedText.trim());
    }
    setPastedText("");
    setPasteMode(false);
  }

  function toggleSource(id: string) {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setCrossAnalysisResult(null);
  }

  return (
    <div className="space-y-8">
      {/* File Upload */}
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-10 text-center hover:border-indigo-500 transition-colors">
        <div className="text-zinc-400 mb-6">
          <p className="text-lg font-medium text-zinc-200">Upload your data</p>
          <p className="text-sm mt-2">
            CSV, TSV, JSON, or any structured tabular data
          </p>
        </div>

        <div className="flex items-center justify-center gap-4">
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
            className={`inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer font-medium transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Select files
          </label>
          <button
            onClick={() => { setPasteMode(!pasteMode); setDiscoverMode(false); }}
            disabled={disabled}
            className={`px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            Paste data
          </button>
        </div>

        <p className="text-xs text-zinc-600 mt-4">
          LITMUS will profile the data, generate hypotheses, run statistical tests, and validate findings through a 5-check skeptic gauntlet.
        </p>
      </div>

      {/* Paste Data Section */}
      {pasteMode && (
        <div className="border border-zinc-700 rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-zinc-300">Paste your data</h2>
            <span className="text-xs text-zinc-500">Auto-detects CSV, TSV, JSON, or space-delimited</span>
          </div>
          <textarea
            className="w-full h-40 bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-zinc-200 text-sm font-mono resize-y focus:outline-none focus:border-indigo-500 placeholder:text-zinc-600"
            placeholder={"col1,col2,col3\n1,2,3\n4,5,6\n\n# or paste TSV, JSON arrays, space-delimited tables..."}
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={disabled}
          />
          <div className="flex gap-3">
            <button
              onClick={handleSubmitPaste}
              disabled={disabled || !pastedText.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Analyze Pasted Data
            </button>
            <button
              onClick={() => { setPasteMode(false); setPastedText(""); }}
              className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Demo Dataset Picker */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4">
          Or try a demo dataset
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {DEMO_DATASETS.map((ds) => (
            <button
              key={ds.id}
              onClick={() => onDemoDataset(ds.id)}
              disabled={disabled}
              className={`text-left p-5 rounded-xl border border-zinc-700 hover:border-indigo-500 hover:bg-zinc-800/50 transition-all group ${
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <p className="font-semibold text-zinc-100 group-hover:text-indigo-300 transition-colors">
                  {ds.name}
                </p>
                <div className="flex gap-1 ml-2 flex-shrink-0">
                  {ds.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-0.5 bg-zinc-700 text-zinc-400 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{ds.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Connected Data Sources — Virtual MCP */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-widest mb-4">
          Or explore connected data sources
        </h2>

        {!discoverMode ? (
          <button
            onClick={handleDiscoverSources}
            disabled={disabled}
            className={`w-full p-5 rounded-xl border border-zinc-700 hover:border-emerald-500 hover:bg-zinc-800/50 transition-all text-left group ${
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-sm">
                ⊕
              </div>
              <div>
                <p className="font-semibold text-zinc-100 group-hover:text-emerald-300 transition-colors">
                  Discover Data Sources
                </p>
                <p className="text-sm text-zinc-500 mt-0.5">
                  Scan connected databases, MCP endpoints, and local datasets
                </p>
              </div>
            </div>
          </button>
        ) : (
          <div className="border border-zinc-700 rounded-xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-zinc-200">Available Data Sources</h3>
              <button
                onClick={() => { setDiscoverMode(false); setSelectedSources(new Set()); setCrossAnalysisResult(null); }}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                Close
              </button>
            </div>

            {loadingSources ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <div className="w-4 h-4 border-2 border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
                Scanning data sources...
              </div>
            ) : dataSources.length === 0 ? (
              <p className="text-zinc-500 text-sm">No data sources found. Add CSV files to data/demo-datasets/ or configure an MCP endpoint.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500">
                  Select 2+ datasets to run cross-dataset hypothesis generation
                </p>
                {dataSources.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => toggleSource(source.id)}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedSources.has(source.id)
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-zinc-700 hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center text-xs ${
                          selectedSources.has(source.id)
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-zinc-600"
                        }`}>
                          {selectedSources.has(source.id) ? "✓" : ""}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-200 text-sm">{source.name}</p>
                          <p className="text-xs text-zinc-500">{source.description}</p>
                        </div>
                      </div>
                      <div className="text-xs text-zinc-600">
                        {source.tables.length} table{source.tables.length !== 1 ? "s" : ""}
                        {source.tables.map((t) => (
                          <span key={t.name} className="ml-1 text-zinc-700">
                            · {t.name} ({t.rowCount}r)
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}

                {selectedSources.size >= 2 && (
                  <button
                    onClick={handleCrossAnalysis}
                    disabled={loadingCross}
                    className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingCross ? "Generating cross-dataset hypotheses..." : `Analyze ${selectedSources.size} datasets together →`}
                  </button>
                )}

                {crossAnalysisResult && (
                  <div className="space-y-3 pt-2 border-t border-zinc-800">
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">
                        Common columns: {crossAnalysisResult.commonColumns.join(", ") || "none found"}
                      </p>
                    </div>
                    <p className="text-sm font-medium text-zinc-300">
                      Cross-dataset hypotheses ({crossAnalysisResult.hypotheses.length}):
                    </p>
                    {crossAnalysisResult.hypotheses.map((h, i) => (
                      <div key={h.id || i} className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm">
                        <div className="flex justify-between items-start gap-2">
                          <p className="text-zinc-300">{h.hypothesis}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${
                            h.priority === "high" ? "bg-emerald-500/20 text-emerald-400" :
                            h.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" :
                            "bg-zinc-700 text-zinc-400"
                          }`}>
                            {h.priority}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-1">
                          Datasets: {h.datasets.join(", ")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
