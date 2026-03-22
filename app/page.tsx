"use client";

/**
 * LITMUS Main Page
 *
 * Upload training artifacts (weight snapshots, loss CSVs, attention maps).
 * Kicks off 5-stage discovery pipeline. Streams reasoning + results.
 *
 * Layout:
 *   Left panel: DataUpload + HypothesisList
 *   Right panel: ExperimentResult + ValidationBadge + DiscoveryReport
 *   Bottom: real-time reasoning stream (SSE from each agent)
 */

import { useState } from "react";
import DataUpload from "@/components/DataUpload";
import HypothesisList from "@/components/HypothesisList";
import ExperimentResult from "@/components/ExperimentResult";
import ValidationBadge from "@/components/ValidationBadge";
import DiscoveryReport from "@/components/DiscoveryReport";

export type PipelineStage =
  | "idle"
  | "profiling"
  | "hypothesizing"
  | "experimenting"
  | "validating"
  | "narrating"
  | "done";

export interface Hypothesis {
  id: string;
  text: string;
  surpriseScore: number;
  status: "pending" | "testing" | "validated" | "rejected";
  grade?: "A" | "B" | "C";
}

export interface ExperimentResultData {
  hypothesisId: string;
  testName: string;
  pValue: number;
  effectSize: number;
  plotUrl?: string;
  interpretation: string;
}

export default function Home() {
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([]);
  const [results, setResults] = useState<ExperimentResultData[]>([]);
  const [report, setReport] = useState<string>("");

  /**
   * TODO: Wire SSE streaming from each API route.
   * Flow: upload -> /api/profile -> /api/hypothesize -> /api/experiment -> /api/validate -> /api/narrate
   * Each stage streams progress. Results feed back into hypothesizer.
   */

  return (
    <main className="min-h-screen p-8 max-w-7xl mx-auto">
      <header className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight">LITMUS</h1>
        <p className="text-zinc-400 mt-2">
          Autonomous discovery agent for transformer training dynamics
        </p>
      </header>

      {stage === "idle" ? (
        <DataUpload
          onUpload={(files) => {
            // TODO: Start pipeline
            setStage("profiling");
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-6">
            <HypothesisList hypotheses={hypotheses} activeStage={stage} />
          </div>
          <div className="space-y-6">
            <ExperimentResult results={results} />
            <ValidationBadge hypotheses={hypotheses} />
            {stage === "done" && <DiscoveryReport report={report} />}
          </div>
        </div>
      )}

      <footer className="mt-16 text-zinc-600 text-sm">
        Stage: {stage}
      </footer>
    </main>
  );
}
