"use client";

import { useState, useCallback, useRef } from "react";

const DATASETS = [
  {
    id: "simpsons-paradox",
    icon: "⚖️",
    name: "Simpson's Paradox",
    desc: "A/B test where treatment appears worse overall — but wins in every segment.",
    tags: ["A/B Test", "Causality"],
  },
  {
    id: "startup-metrics",
    icon: "📈",
    name: "Startup Metrics",
    desc: "18 months of SaaS data with churn spikes and a genuine PMF signal.",
    tags: ["SaaS", "Time Series"],
  },
  {
    id: "clinical-trial",
    icon: "🧬",
    name: "Clinical Trial",
    desc: "Phase III RCT: 2 real effects, 3 spurious, and a multiple-testing trap.",
    tags: ["Clinical", "FDR"],
  },
  {
    id: "feature-drift",
    icon: "📉",
    name: "Feature Drift",
    desc: "90 days of ML monitoring: gradual drift, a pipeline bug, seasonal pattern.",
    tags: ["ML Ops", "Drift"],
  },
  {
    id: "grokking",
    icon: "🧠",
    name: "Grokking Detection",
    desc: "Transformer training with phase transitions and attention specialization.",
    tags: ["ML", "Temporal"],
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
    <div className="stack" style={{ gap: 24 }}>
      {/* Upload zone */}
      <div
        className={`upload-zone${dragging ? " dragging" : ""}${disabled ? " disabled" : ""}`}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={e => { e.preventDefault(); setDragging(false); }}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: "#27272a", display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 14px", fontSize: 22
        }}>
          {dragging ? "↓" : "↑"}
        </div>
        <p style={{ fontWeight: 600, color: "#f4f4f5", marginBottom: 6 }}>
          {dragging ? "Drop files here" : "Upload your dataset"}
        </p>
        <p style={{ fontSize: 12, color: "#52525b", marginBottom: 16 }}>
          Drag & drop or click — CSV, JSON, TSV, TXT
        </p>
        <button
          className="btn btn-primary"
          onClick={e => { e.stopPropagation(); inputRef.current?.click(); }}
          disabled={disabled}
        >
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
      </div>

      {/* Divider */}
      <div className="divider">or try a demo dataset</div>

      {/* Demo datasets */}
      <div className="grid-3">
        {DATASETS.map(ds => (
          <button
            key={ds.id}
            className="card-interactive"
            onClick={() => onDemoDataset(ds.id)}
            disabled={disabled}
          >
            <div className="row" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{ds.icon}</span>
              <span style={{ fontWeight: 600, fontSize: 13, color: "#f4f4f5" }}>{ds.name}</span>
            </div>
            <p style={{ fontSize: 12, color: "#71717a", marginBottom: 10, lineHeight: 1.6 }}>
              {ds.desc}
            </p>
            <div className="row" style={{ flexWrap: "wrap", gap: 4 }}>
              {ds.tags.map(t => (
                <span key={t} className="badge badge-tag">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
