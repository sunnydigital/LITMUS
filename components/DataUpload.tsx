"use client";

/**
 * DataUpload
 *
 * Upload CSV data files or select from built-in demo datasets.
 * Supports file upload and one-click demo dataset selection.
 */

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

interface DataUploadProps {
  onUpload: (files: File[]) => void;
  onDemo: () => void;
  onDemoDataset: (datasetId: string) => void;
  disabled?: boolean;
}

export default function DataUpload({ onUpload, onDemoDataset, disabled }: DataUploadProps) {
  return (
    <div className="space-y-8">
      {/* File Upload */}
      <div className="border-2 border-dashed border-zinc-700 rounded-xl p-10 text-center hover:border-indigo-500 transition-colors">
        <div className="text-zinc-400 mb-6">
          <p className="text-lg font-medium text-zinc-200">Upload your data</p>
          <p className="text-sm mt-2">
            CSV files, JSON configs, metrics logs — any structured tabular data
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
        </div>

        <p className="text-xs text-zinc-600 mt-4">
          LITMUS will profile the data, generate hypotheses, run statistical tests, and validate findings through a 5-check skeptic gauntlet.
        </p>
      </div>

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
    </div>
  );
}
