import { CheckCircle, Loader2, Circle, AlertCircle } from "lucide-react";

interface ProofStep {
  label: string;
  duration: number;
}

interface ProofGenerationPanelProps {
  steps: ProofStep[];
  currentStep: number;
  completedSteps: number[];
  error?: string | null;
}

export function ProofGenerationPanel({ steps, currentStep, completedSteps, error }: ProofGenerationPanelProps) {
  const totalDuration = steps.reduce((s, st) => s + st.duration, 0);
  const elapsed = completedSteps.reduce((s, i) => s + (steps[i]?.duration ?? 0), 0);
  const progress = totalDuration > 0 ? Math.round((elapsed / totalDuration) * 100) : 0;

  return (
    <div
      className="p-5 rounded-xl"
      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Generating ZK Proof
        </p>
        <span className="text-xs font-mono" style={{ color: "var(--accent-primary)" }}>
          {progress}%
        </span>
      </div>

      <div className="h-1 rounded-full mb-5 overflow-hidden" style={{ background: "var(--border-default)" }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progress}%`, background: "var(--accent-primary)" }}
        />
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const isDone = completedSteps.includes(i);
          const isActive = currentStep === i;
          const isPending = !isDone && !isActive;

          return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {isDone ? (
                  <CheckCircle size={16} style={{ color: "var(--accent-success)" }} />
                ) : isActive ? (
                  <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent-primary)" }} />
                ) : (
                  <Circle size={16} style={{ color: "var(--text-tertiary)" }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{
                    color: isDone
                      ? "var(--accent-success)"
                      : isActive
                      ? "var(--text-primary)"
                      : "var(--text-tertiary)",
                  }}
                >
                  {step.label}
                </p>
                {isActive && (
                  <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--border-default)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: "var(--accent-primary)",
                        animation: `expand ${step.duration}ms linear forwards`,
                        width: "0%",
                      }}
                    />
                  </div>
                )}
              </div>
              {isDone && (
                <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
                  {(steps[i].duration / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div
          className="flex items-center gap-2 mt-4 p-3 rounded-lg text-sm"
          style={{ background: "var(--accent-danger-subtle)", color: "var(--accent-danger)" }}
        >
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      <style>{`
        @keyframes expand { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
}
