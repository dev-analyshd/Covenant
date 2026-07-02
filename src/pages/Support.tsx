import { ExternalLink, MessageSquare, BookOpen, Github, Zap } from "lucide-react";

const LINKS = [
  {
    icon: <BookOpen size={18} />,
    title: "Documentation",
    description: "Circuit specs, API reference, contract ABIs",
    href: "https://github.com/stellar/stellar-protocol",
    label: "Read docs",
  },
  {
    icon: <Github size={18} />,
    title: "GitHub",
    description: "Source code, issues, and pull requests",
    href: "https://github.com",
    label: "View repo",
  },
  {
    icon: <MessageSquare size={18} />,
    title: "Stellar Discord",
    description: "Community help and developer discussion",
    href: "https://discord.gg/stellar",
    label: "Join Discord",
  },
  {
    icon: <Zap size={18} />,
    title: "Stellar Hacks",
    description: "Real-World ZK hackathon · $10K prize pool",
    href: "https://stellarhacks.com",
    label: "View hackathon",
  },
];

export default function Support() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Support</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Resources and community for Covenant</p>
      </div>

      <div className="space-y-3">
        {LINKS.map(({ icon, title, description, href, label }) => (
          <a
            key={title}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-4 p-4 rounded-xl transition-all hover:opacity-90"
            style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)", textDecoration: "none" }}
          >
            <div className="rounded-lg p-2.5 flex-shrink-0" style={{ background: "var(--accent-primary-subtle)", color: "var(--accent-primary)" }}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{description}</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium flex-shrink-0" style={{ color: "var(--accent-primary)" }}>
              {label} <ExternalLink size={11} />
            </div>
          </a>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-xl" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-default)" }}>
        <p className="text-xs font-semibold mb-1" style={{ color: "var(--text-tertiary)" }}>TESTNET INFO</p>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Covenant is deployed on <strong style={{ color: "var(--text-primary)" }}>Stellar Testnet (Protocol 26)</strong>.
          All transactions use testnet XLM — no real funds are at risk.
          The demo account holds ~9,975 testnet XLM for experiments.
        </p>
      </div>
    </div>
  );
}
