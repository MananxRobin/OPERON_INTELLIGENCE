import { useMemo, useState } from 'react';

import type { EvidenceReference, FullAnalysis } from '../../store';

type EvidenceFocus = 'severity' | 'compliance' | 'routing' | 'review';

const LABELS: Record<EvidenceFocus, string> = {
  severity: 'Severity',
  compliance: 'Compliance',
  routing: 'Routing',
  review: 'Review',
};

function renderNarrative(text: string, refs: EvidenceReference[]) {
  const usable = refs
    .filter((ref) => Number.isFinite(ref.start) && Number.isFinite(ref.end) && ref.end > ref.start)
    .sort((left, right) => left.start - right.start);

  if (!usable.length) {
    return text;
  }

  const parts: Array<string | { text: string; label: string }> = [];
  let cursor = 0;

  for (const ref of usable) {
    if (ref.start < cursor) continue;
    if (cursor < ref.start) parts.push(text.slice(cursor, ref.start));
    parts.push({ text: text.slice(ref.start, ref.end), label: ref.label });
    cursor = ref.end;
  }

  if (cursor < text.length) parts.push(text.slice(cursor));

  return parts.map((part, index) => {
    if (typeof part === 'string') return <span key={index}>{part}</span>;
    return (
      <mark
        key={index}
        title={part.label}
        style={{
          background: 'var(--highlight)',
          color: 'var(--primary)',
          padding: '0 2px',
          borderRadius: 2,
          boxShadow: 'inset 0 -1px 0 color-mix(in srgb, var(--accent) 35%, transparent)',
        }}
      >
        {part.text}
      </mark>
    );
  });
}

export function EvidencePanel({ analysis }: { analysis: FullAnalysis | null }) {
  const [focus, setFocus] = useState<EvidenceFocus>('severity');
  const refs = analysis?.evidence_map?.[focus] ?? [];
  const narrative = analysis?.complaint?.narrative ?? '';

  const countByFocus = useMemo(
    () => ({
      severity: analysis?.evidence_map?.severity.length ?? 0,
      compliance: analysis?.evidence_map?.compliance.length ?? 0,
      routing: analysis?.evidence_map?.routing.length ?? 0,
      review: analysis?.evidence_map?.review.length ?? 0,
    }),
    [analysis]
  );

  return (
    <section className="panel">
      <div className="panel-header">
        <span className="section-label">Evidence View</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['severity', 'compliance', 'routing', 'review'] as EvidenceFocus[]).map((item) => (
            <button
              key={item}
              className="btn btn-ghost"
              onClick={() => setFocus(item)}
              style={{
                fontSize: 9,
                padding: '4px 10px',
                borderColor: focus === item ? 'var(--accent)' : 'var(--border)',
                color: focus === item ? 'var(--accent)' : 'var(--secondary)',
                background: focus === item ? 'var(--highlight)' : 'transparent',
              }}
            >
              {LABELS[item]} ({countByFocus[item]})
            </button>
          ))}
        </div>
      </div>
      <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1.25fr 0.9fr', gap: 16 }}>
        <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', padding: '12px 14px', fontSize: 11, color: 'var(--secondary)', lineHeight: 1.8 }}>
          {narrative ? renderNarrative(narrative, refs) : 'Narrative unavailable.'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {refs.length ? refs.map((ref, index) => (
            <div key={`${ref.label}-${index}`} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderLeft: '2px solid var(--accent)', padding: '10px 12px' }}>
              <div style={{ fontSize: 9, color: 'var(--text-weak)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {ref.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--primary)', marginBottom: 4 }}>
                "{ref.quote}"
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>{ref.source}</div>
            </div>
          )) : (
            <div style={{ fontSize: 10, color: 'var(--text-faint)' }}>
              No structured evidence captured for this decision lens yet.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
