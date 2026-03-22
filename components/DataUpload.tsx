"use client";

/**
 * DataUpload
 *
 * Upload training artifacts or run with demo data.
 * Simplified: file picker + "Run Demo" button.
 */

interface DataUploadProps {
  onUpload: (files: File[]) => void;
  onDemo: () => void;
  disabled?: boolean;
}

export default function DataUpload({ onUpload, onDemo, disabled }: DataUploadProps) {
  return (
    <div className="border-2 border-dashed border-zinc-700 rounded-xl p-16 text-center hover:border-indigo-500 transition-colors">
      <div className="text-zinc-400 mb-6">
        <p className="text-lg font-medium text-zinc-200">
          Upload training artifacts
        </p>
        <p className="text-sm mt-2">
          Loss CSVs, metrics logs, config files, gradient norms
        </p>
      </div>

      <div className="flex items-center justify-center gap-4">
        <input
          type="file"
          multiple
          accept=".csv,.json,.yaml,.toml,.pt,.safetensors,.npy"
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

        <span className="text-zinc-600">or</span>

        <button
          onClick={onDemo}
          disabled={disabled}
          className={`px-6 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-600 rounded-lg font-medium transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          Run Demo
        </button>
      </div>

      <p className="text-xs text-zinc-600 mt-4">
        Demo uses synthetic nanoGPT training data with a grokking phase transition
      </p>
    </div>
  );
}
