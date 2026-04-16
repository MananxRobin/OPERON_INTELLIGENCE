import type { ComplaintSummary } from '../store';

const API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string;

const PROMPT = (count: number) => `Generate exactly ${count} realistic CFPB consumer financial complaint records as a JSON array.

Each object must have EXACTLY these fields with the types shown:
{
  "complaint_id": "DS-XXXXXX",        // DS- followed by 6 random digits, unique
  "status": "analyzed",
  "product": string,                   // one of: "Mortgage", "Credit card or prepaid card", "Credit reporting, credit repair services", "Debt collection", "Student loan", "Checking or savings account", "Vehicle loan or lease"
  "issue": string,                     // realistic 4-8 word issue for that product
  "severity": string,                  // "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"  (distribution: 42% LOW, 27% MEDIUM, 20% HIGH, 11% CRITICAL)
  "risk_level": string,                // same value as severity
  "risk_score": number,                // 10-34 for LOW, 35-55 for MEDIUM, 56-75 for HIGH, 76-100 for CRITICAL
  "assigned_team": string,             // team appropriate for product, e.g. "Mortgage Servicing Team", "Card Services Team", "Collections Compliance Team"
  "priority": string,                  // same as severity
  "submitted_at": string,              // ISO timestamp within last 14 days, varied times of day
  "completed_at": string,              // ISO timestamp 30 min – 4 hrs after submitted_at
  "narrative_preview": string,         // 1 realistic sentence describing the consumer's complaint
  "channel": string,                   // "web" | "phone" | "mail"
  "customer_state": string,            // 2-letter US state abbreviation (CA, TX, FL, NY most common)
  "tags": string[],                    // 2-3 relevant tags, always include the severity lowercase
  "processing_time_ms": number         // 800-5200
}

Rules:
- Vary companies (JPMorgan, BofA, Wells Fargo, Citi, Capital One, etc.)
- Vary states realistically by population
- Make narratives specific and varied, not generic
- CRITICAL items should have untimely/disputed context in narrative
- Return ONLY a valid JSON array, no markdown fences, no extra text`;

export async function generateBatchViaDeepSeek(count = 50): Promise<ComplaintSummary[]> {
  if (!API_KEY) {
    console.warn('[DeepSeek] No API key — skipping generation');
    return [];
  }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: 'You are a synthetic financial data generator. Always respond with valid JSON only — no markdown, no explanations, no code fences.',
          },
          {
            role: 'user',
            content: PROMPT(count),
          },
        ],
        temperature: 0.92,
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      console.error('[DeepSeek] API error:', res.status, await res.text());
      return [];
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? '';

    // Strip any accidental markdown fences
    const cleaned = content.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

    let parsed: any[];
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // Sometimes the model returns partial JSON — try to salvage by finding the array
      const start = cleaned.indexOf('[');
      const end   = cleaned.lastIndexOf(']');
      if (start === -1 || end === -1) { console.error('[DeepSeek] Could not parse response'); return []; }
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    }

    if (!Array.isArray(parsed)) return [];

    // Sanitize and type-check each entry
    return parsed
      .filter(c => c && typeof c === 'object' && c.complaint_id && c.product)
      .map(c => ({
        complaint_id:       String(c.complaint_id),
        status:             'analyzed',
        product:            c.product    ?? null,
        issue:              c.issue      ?? null,
        severity:           c.severity   ?? 'LOW',
        risk_level:         c.risk_level ?? c.severity ?? 'LOW',
        risk_score:         Number(c.risk_score) || 20,
        assigned_team:      c.assigned_team ?? null,
        priority:           c.priority   ?? c.severity ?? 'LOW',
        submitted_at:       c.submitted_at ?? new Date().toISOString(),
        completed_at:       c.completed_at ?? null,
        narrative_preview:  c.narrative_preview ?? '',
        channel:            c.channel    ?? 'web',
        customer_state:     c.customer_state ?? null,
        tags:               Array.isArray(c.tags) ? c.tags : [],
        processing_time_ms: Number(c.processing_time_ms) || 1200,
        vulnerable_tags:    Array.isArray(c.tags) ? c.tags.filter((tag: string) => ['Older American', 'Servicemember'].includes(tag)) : [],
        criticality_score:  Math.min(100, (Number(c.risk_score) || 20) + 8),
        criticality_level:  c.risk_level ?? c.severity ?? 'LOW',
        needs_human_review: (c.risk_level ?? c.severity ?? 'LOW') === 'CRITICAL',
        review_reason_codes: (c.risk_level ?? c.severity ?? 'LOW') === 'CRITICAL' ? ['CRITICAL_REGULATORY_RISK'] : [],
        sla_breach_risk:    ['CRITICAL', 'HIGH'].includes(c.risk_level ?? c.severity ?? 'LOW'),
        source:             'deepseek_generated',
        source_label:       'deepseek_feed',
        baseline_delta:     {
          changed_fields: ['risk_level'],
          risk_score_delta: 12,
          routing_changed: true,
          severity_changed: true,
          sla_changed: true,
          divergence_score: 2,
        },
        latest_review_decision: null,
      } as ComplaintSummary));
  } catch (err) {
    console.error('[DeepSeek] Unexpected error:', err);
    return [];
  }
}
