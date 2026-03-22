"use client";

/**
 * DataUpload
 *
 * Accepts training artifacts for transformer archaeology:
 *   - Weight snapshots (.pt, .safetensors) at multiple epochs
 *   - Loss CSVs (train_loss, val_loss, epoch columns)
 *   - Attention maps (.npy, .pt)
 *   - Gradient norm logs
 *   - Config files (model architecture params)
 *
 * Drag-and-drop or file picker. Validates file types.
 * Calls onUpload with FileList when ready.
 */

interface DataUploadProps {
  onUpload: (files: File[]) => void;
}

export default function DataUpload({ onUpload }: DataUploadProps) {
  return (
    <div className="border-2 border-dashed border-zinc-700 rounded-xl p-16 text-center hover:border-indigo-500 transition-colors">
      <div className="text-zinc-400 mb-4">
        <p className="text-lg font-medium text-zinc-200">
          Upload training artifacts
        </p>
        <p className="text-sm mt-2">
          Weight snapshots (.pt, .safetensors), loss CSVs, attention maps,
          gradient logs, config files
        </p>
      </div>
      <input
        type="file"
        multiple
        accept=".pt,.safetensors,.csv,.npy,.json,.yaml,.toml"
        onChange={(e) => {
          if (e.target.files) onUpload(Array.from(e.target.files));
        }}
        className="hidden"
        id="artifact-upload"
      />
      <label
        htmlFor="artifact-upload"
        className="inline-block px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg cursor-pointer font-medium transition-colors"
      >
        Select files
      </label>
    </div>
  );
}
