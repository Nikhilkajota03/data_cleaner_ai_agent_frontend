export default function ScoreGauge({ score, label = "Judge" }: { score: number | null; label?: string }) {
  const r = 50;
  const c = 2 * Math.PI * r;
  const value = score ?? 0;
  const pct = Math.max(0, Math.min(1, value));
  const color = score === null ? "#64748b" : pct >= 0.8 ? "#22c55e" : pct >= 0.5 ? "#f59e0b" : "#f43f5e";
  return (
    <div className="gauge" role="img" aria-label={`${label} score ${score === null ? "pending" : value.toFixed(2)}`}>
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle className="gauge-track" cx="60" cy="60" r={r} fill="none" strokeWidth="10" />
        <circle
          className="gauge-bar"
          cx="60"
          cy="60"
          r={r}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="gauge-label">
        <div>
          <div className="gauge-value" style={{ color }}>{score === null ? "—" : value.toFixed(2)}</div>
          <div className="gauge-cap">{label}</div>
        </div>
      </div>
    </div>
  );
}
