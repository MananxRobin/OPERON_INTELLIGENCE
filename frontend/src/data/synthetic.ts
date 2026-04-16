import type { ComplaintSummary, DashboardStats, DashboardTrends, SyntheticCfpbRow } from '../store';

// ─── Weighted random pick ─────────────────────────────────────────────────────
function wp<T>(items: T[], weights: number[]): T {
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= weights[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function rnd(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function rndDate(daysBack = 30): string {
  const days = Math.random() < 0.55 ? Math.random() * 7 : 7 + Math.random() * (daysBack - 7);
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(days));
  d.setHours(rnd(7, 22), rnd(0, 59), rnd(0, 59));
  return d.toISOString();
}

// ─── Reference data ───────────────────────────────────────────────────────────
const COMPANIES = [
  { n: 'JPMorgan Chase Bank, N.A.',          w: 46 },
  { n: 'Bank of America, N.A.',              w: 42 },
  { n: 'Wells Fargo Bank, N.A.',             w: 40 },
  { n: 'Citibank, N.A.',                     w: 34 },
  { n: 'Capital One Financial Corporation',  w: 30 },
  { n: 'Synchrony Bank',                     w: 21 },
  { n: 'Discover Bank',                      w: 19 },
  { n: 'USAA Federal Savings Bank',          w: 15 },
  { n: 'Navy Federal Credit Union',          w: 13 },
  { n: 'American Express Company',           w: 13 },
  { n: 'TD Bank, N.A.',                      w: 11 },
  { n: 'PNC Bank, N.A.',                     w: 11 },
  { n: 'U.S. Bank N.A.',                     w: 10 },
  { n: 'Equifax, Inc.',                      w: 9  },
  { n: 'TransUnion Intermediate Holdings',   w: 9  },
  { n: 'Experian Information Solutions',     w: 9  },
  { n: 'Ally Financial Inc.',                w: 8  },
  { n: 'SoFi Bank, N.A.',                    w: 7  },
  { n: 'Navient Solutions, LLC',             w: 7  },
  { n: 'Sallie Mae Bank',                    w: 6  },
  { n: 'Ocwen Loan Servicing, LLC',          w: 6  },
  { n: 'Marcus by Goldman Sachs Bank USA',   w: 5  },
  { n: 'Regions Bank',                       w: 5  },
  { n: 'Fifth Third Bank, National Association', w: 4 },
  { n: 'KeyBank N.A.',                       w: 4  },
];

const PRODUCTS = [
  {
    name: 'Mortgage', w: 26, team: 'Mortgage Servicing Team',
    issues: [
      'Loan servicing, payments, escrow account',
      'Struggling to pay mortgage',
      'Applying for a mortgage or refinancing',
      'Loan modification, collection, foreclosure',
      'Trouble during payment process',
      'Closing on a mortgage',
    ],
    regs: ['RESPA', 'TILA', 'ECOA', 'HMDA'],
    narratives: [
      'Servicer failed to apply payments correctly and reported delinquency without prior notice.',
      'Loan modification was completed but servicer continues charging pre-modification payment amount.',
      'Escrow account was miscalculated resulting in an unexpected large shortage payment demand.',
      'Foreclosure initiated despite an active loss-mitigation application review process.',
      'Mortgage servicer transferred my loan and the new servicer has no record of prior payments.',
      'Unauthorized fees were added to my mortgage balance without any disclosure or agreement.',
      'My refinancing application was denied without the required adverse action notice.',
    ],
  },
  {
    name: 'Credit card or prepaid card', w: 23, team: 'Card Services Team',
    issues: [
      'Problem with a purchase shown on your statement',
      'Fees or interest charged incorrectly',
      'Getting a credit card',
      'Problem when making payments',
      'Closing your account without notice',
      'Identity theft resulting in unauthorized charges',
      'Advertising and marketing, including promotional offers',
    ],
    regs: ['TILA', 'FCBA', 'ECOA'],
    narratives: [
      'Fraudulent charges appeared on my statement and the bank refused to process a chargeback.',
      'I was charged a late fee even though my payment was submitted on time through online banking.',
      'My account was closed without notice, severely impacting my credit utilization ratio.',
      'Promotional APR was not applied as advertised and I am being charged the standard rate.',
      'An unauthorized cash advance of over $1,000 appeared on my statement.',
      'The credit card company is refusing to investigate a dispute I filed six weeks ago.',
      'I was denied a credit card without receiving the required adverse action notice.',
    ],
  },
  {
    name: 'Credit reporting, credit repair services', w: 19, team: 'Credit Operations Team',
    issues: [
      'Incorrect information on your report',
      "Problem with a credit reporting company's investigation",
      'Unable to get your credit report or credit score',
      'Improper use of your report',
      'Problem with fraud alerts or security freezes',
    ],
    regs: ['FCRA', 'ECOA'],
    narratives: [
      'An erroneous collection account is being reported despite being paid in full two years ago.',
      'My dispute was closed without investigation and the bureau continues reporting inaccurate data.',
      'A hard inquiry appeared on my report from a lender I never applied to.',
      'After filing a security freeze, an unauthorized account was still opened in my name.',
      'I have disputed the same inaccuracy five times and the bureau consistently fails to correct it.',
      'Medical debt that was fully covered by insurance is appearing on my credit report.',
    ],
  },
  {
    name: 'Debt collection', w: 16, team: 'Collections Compliance Team',
    issues: [
      'Attempts to collect debt not owed',
      'Written notification about debt',
      'False statements or representation',
      'Communication tactics',
      'Took or threatened to take negative or legal action',
    ],
    regs: ['FDCPA', 'CFPA'],
    narratives: [
      'Collector is calling my workplace multiple times daily despite cease-communication requests.',
      'I am receiving collection calls for a debt that was discharged in bankruptcy.',
      'Collector threatened legal action for a debt that is well past the statute of limitations.',
      'Collection agency failed to send the required 30-day validation notice.',
      'I am being contacted for a debt that belongs to a different person with a similar name.',
      'Collector misrepresented the amount owed by adding unauthorized fees and interest.',
    ],
  },
  {
    name: 'Student loan', w: 8, team: 'Student Lending Team',
    issues: [
      'Dealing with my lender or servicer',
      "Can't repay my loan",
      'Getting a loan',
      'Problem with a credit reporting company\'s investigation into my existing problem',
      'Problem with income-driven repayment plan',
    ],
    regs: ['HEA', 'TILA', 'FCRA'],
    narratives: [
      'My servicer has been misapplying payments and I have been overcharged significantly.',
      'I was told I qualified for Public Service Loan Forgiveness but am now deemed ineligible.',
      'Income-driven repayment plan application has been pending for over four months.',
      'My servicer transferred my loan and lost records of my qualifying PSLF payments.',
      'I cannot get a response from my servicer regarding my total and permanent disability discharge.',
    ],
  },
  {
    name: 'Checking or savings account', w: 8, team: 'Retail Banking Team',
    issues: [
      'Managing an account',
      'Problem with a lender or servicer',
      'Opening an account',
      'Closing an account',
      'Unexpected fees charged to account',
      'Problem using a debit or ATM card',
    ],
    regs: ['EFTA', 'TISA', 'CFPA'],
    narratives: [
      'My bank account was frozen without notice preventing access to rent and grocery funds.',
      'Overdraft fees were charged despite having previously opted out of overdraft protection.',
      'A wire transfer was sent to an incorrect account and the bank refuses to attempt a reversal.',
      'My account was closed without notice and the bank is holding my funds for 90 days.',
      'I was charged multiple maintenance fees without any prior disclosure or agreement.',
    ],
  },
  {
    name: 'Vehicle loan or lease', w: 5, team: 'Auto Lending Team',
    issues: [
      'Managing the loan or lease',
      'Problem with a credit reporting company\'s investigation',
      'Struggling to pay your loan',
      'Fraudulent loan',
      'Problems at the end of the loan or lease',
    ],
    regs: ['TILA', 'ECOA', 'CFPA'],
    narratives: [
      'Dealer added unauthorized add-on products to my loan inflating payments by $200 monthly.',
      'My vehicle was repossessed while a payment dispute was actively under investigation.',
      'Loan servicer reported me as delinquent despite my payments being current.',
      'Lease-end fees include charges for pre-existing damage not noted at lease signing.',
      'I have been trying to obtain a payoff amount for three weeks without a response.',
    ],
  },
];

const STATE_WTS: [string, number][] = [
  ['CA',42],['TX',38],['FL',35],['NY',31],['PA',19],['IL',18],['OH',16],['GA',14],
  ['NC',14],['MI',13],['NJ',12],['VA',12],['WA',11],['AZ',10],['MA',10],['TN',9],
  ['IN',9],['MO',9],['MD',8],['WI',8],['CO',8],['MN',8],['SC',7],['AL',7],['LA',7],
  ['KY',6],['OR',6],['OK',6],['CT',6],['UT',5],['NV',5],['AR',5],['MS',5],['IA',5],
  ['KS',4],['NM',4],['NE',4],['WV',3],['ID',3],['HI',3],['NH',3],['ME',2],['RI',2],
  ['MT',2],['DE',2],['SD',2],['ND',2],['AK',2],['VT',2],['WY',1],['DC',3],
];

const RESPONSES = [
  { v: 'Closed with explanation',           w: 38 },
  { v: 'Closed with non-monetary relief',   w: 24 },
  { v: 'Closed with monetary relief',       w: 16 },
  { v: 'In progress',                       w: 12 },
  { v: 'Untimely response',                 w: 6  },
  { v: 'Closed without relief',             w: 4  },
];

const CHANNELS = ['web', 'phone', 'mail', 'fax'];
const CHANNEL_WTS = [55, 28, 12, 5];

const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// ─── Risk/severity derivation ─────────────────────────────────────────────────
function computeRisk(response: string, disputed: boolean): { sev: string; score: number } {
  const untimely = response === 'Untimely response';
  const noRelief = response === 'Closed without relief';
  if (untimely || disputed)          return { sev: 'CRITICAL', score: rnd(76, 100) };
  if (noRelief || response === 'In progress') return { sev: 'HIGH',     score: rnd(56, 75)  };
  if (response === 'Closed with non-monetary relief') return { sev: 'MEDIUM', score: rnd(35, 55) };
  return { sev: 'LOW', score: rnd(10, 34) };
}

// ─── Main generator ───────────────────────────────────────────────────────────
let _counter = 1000;

export function generateSyntheticComplaints(count = 350): ComplaintSummary[] {
  const result: ComplaintSummary[] = [];

  for (let i = 0; i < count; i++) {
    const prod     = wp(PRODUCTS, PRODUCTS.map(p => p.w));
    const company  = wp(COMPANIES, COMPANIES.map(c => c.w));
    const state    = wp(STATE_WTS.map(s => s[0]), STATE_WTS.map(s => s[1]));
    const response = wp(RESPONSES, RESPONSES.map(r => r.w)).v;
    const disputed = Math.random() < 0.14;
    const { sev, score } = computeRisk(response, disputed);
    const issue    = prod.issues[rnd(0, prod.issues.length - 1)];
    const narrative = prod.narratives[rnd(0, prod.narratives.length - 1)];
    const channel  = wp(CHANNELS, CHANNEL_WTS);
    const submittedAt = rndDate(30);
    const resMs    = rnd(800, 5200);
    const completedAt = new Date(new Date(submittedAt).getTime() + rnd(60000, 7200000)).toISOString();

    const tags: string[] = [sev.toLowerCase(), prod.regs[rnd(0, prod.regs.length - 1)]];
    if (disputed) tags.push('disputed');
    if (response === 'Untimely response') tags.push('untimely');

    result.push({
      complaint_id:       `SYN-${String(++_counter).padStart(6, '0')}`,
      status:             'analyzed',
      product:            prod.name,
      issue,
      severity:           sev,
      risk_level:         sev,
      risk_score:         score,
      assigned_team:      prod.team,
      priority:           sev,
      submitted_at:       submittedAt,
      completed_at:       completedAt,
      narrative_preview:  narrative,
      channel,
      customer_state:     state,
      tags,
      vulnerable_tags:    tags.filter(tag => ['Older American', 'Servicemember'].includes(tag)),
      processing_time_ms: resMs,
      criticality_score:  Math.min(100, score + rnd(0, 12)),
      criticality_level:  sev,
      needs_human_review: sev === 'CRITICAL' || score >= 68,
      review_reason_codes: sev === 'CRITICAL' ? ['CRITICAL_REGULATORY_RISK'] : score >= 68 ? ['BASELINE_DIVERGENCE'] : [],
      sla_breach_risk:    sev === 'CRITICAL' || sev === 'HIGH',
      source:             'synthetic_seed',
      source_label:       'seeded_demo',
      baseline_delta:     {
        changed_fields: sev === 'LOW' ? [] : ['risk_level'],
        risk_score_delta: sev === 'LOW' ? 4 : 18,
        routing_changed: sev !== 'LOW',
        severity_changed: sev !== 'LOW',
        sla_changed: sev === 'CRITICAL' || sev === 'HIGH',
        divergence_score: sev === 'LOW' ? 0 : sev === 'MEDIUM' ? 1 : 2,
      },
      latest_review_decision: null,
    });
  }

  // Sort descending by date (most recent first)
  return result.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
}

// ─── Derive backend stats from complaints ─────────────────────────────────────
export function deriveStats(complaints: ComplaintSummary[]): DashboardStats {
  const today = new Date().toISOString().slice(0, 10);

  const severityDist: Record<string, number> = {};
  const riskDist:     Record<string, number> = {};
  const prodDist:     Record<string, number> = {};
  const teamDist:     Record<string, number> = {};

  let critCount = 0, highCount = 0, flagCount = 0, timelyCount = 0, todayCount = 0, totalMs = 0;
  let needsHumanReview = 0, highRegRisk = 0, slaBreach = 0;
  const sourceBreakdown: Record<string, number> = {};

  for (const c of complaints) {
    const sev = c.severity ?? 'LOW';
    severityDist[sev]  = (severityDist[sev]  || 0) + 1;
    riskDist[sev]      = (riskDist[sev]      || 0) + 1;
    const prod = (c.product ?? 'Other').slice(0, 28);
    prodDist[prod]     = (prodDist[prod]     || 0) + 1;
    const team = c.assigned_team ?? 'General Team';
    teamDist[team]     = (teamDist[team]     || 0) + 1;

    if (sev === 'CRITICAL') critCount++;
    if (sev === 'HIGH')     highCount++;
    if (sev === 'CRITICAL' || sev === 'HIGH') flagCount++;
    if (c.submitted_at?.slice(0, 10) === today) todayCount++;
    if (c.processing_time_ms) totalMs += c.processing_time_ms;
    if (c.needs_human_review) needsHumanReview++;
    if (c.risk_level === 'CRITICAL' || c.risk_level === 'HIGH') highRegRisk++;
    if (c.sla_breach_risk) slaBreach++;
    sourceBreakdown[c.source] = (sourceBreakdown[c.source] || 0) + 1;

    const tags = c.tags ?? [];
    if (!tags.includes('untimely')) timelyCount++;
  }

  const n = complaints.length || 1;

  return {
    total_complaints:      complaints.length,
    complaints_today:      todayCount,
    avg_resolution_time_hrs: parseFloat(((totalMs / n) / 3_600_000 * 24).toFixed(2)) || 2.4,
    compliance_flags_caught: flagCount,
    auto_resolution_rate:  parseFloat(((complaints.filter(c => c.status === 'analyzed').length / n) * 100).toFixed(1)),
    critical_risk_count:   critCount,
    high_risk_count:       highCount,
    timely_response_rate:  parseFloat(((timelyCount / n) * 100).toFixed(1)),
    product_distribution:  prodDist,
    severity_distribution: severityDist,
    risk_distribution:     riskDist,
    team_distribution:     teamDist,
    needs_human_review_count: needsHumanReview,
    high_regulatory_risk_count: highRegRisk,
    sla_breach_risk_count: slaBreach,
    source_breakdown: sourceBreakdown,
  };
}

// ─── Derive backend trends ────────────────────────────────────────────────────
export function deriveTrends(complaints: ComplaintSummary[]): DashboardTrends {
  const volMap:  Record<string, number> = {};
  const prodMap: Record<string, number> = {};
  const sevMap:  Record<string, number> = {};
  const riskMap: Record<string, number> = {};
  const teamMap: Record<string, number> = {};
  const criticalityMap: Record<string, number> = {};
  const baselineMap: Record<string, number> = { matching: 0, divergent: 0 };

  // Last 14 days only for the trend
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 14);

  for (const c of complaints) {
    const date = c.submitted_at?.slice(0, 10) ?? '';
    if (date && new Date(date) >= cutoff) {
      volMap[date] = (volMap[date] || 0) + 1;
    }
    const prod = (c.product ?? 'Other').slice(0, 28);
    prodMap[prod] = (prodMap[prod] || 0) + 1;
    const sev  = c.severity ?? 'LOW';
    sevMap[sev]  = (sevMap[sev]  || 0) + 1;
    riskMap[sev] = (riskMap[sev] || 0) + 1;
    const team = c.assigned_team ?? 'General Team';
    teamMap[team] = (teamMap[team] || 0) + 1;
    const criticality = c.criticality_level ?? c.severity ?? 'LOW';
    criticalityMap[criticality] = (criticalityMap[criticality] || 0) + 1;
    baselineMap[(c.baseline_delta?.divergence_score ?? 0) >= 2 ? 'divergent' : 'matching']++;
  }

  return {
    complaints_over_time: Object.entries(volMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count })),
    product_breakdown: Object.entries(prodMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([name, value]) => ({ name, value })),
    severity_breakdown: Object.entries(sevMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    risk_breakdown: Object.entries(riskMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    team_breakdown: Object.entries(teamMap)
      .sort((a, b) => b[1] - a[1]).slice(0, 6)
      .map(([name, value]) => ({ name, value })),
    criticality_breakdown: Object.entries(criticalityMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value })),
    baseline_divergence_breakdown: Object.entries(baselineMap)
      .map(([name, value]) => ({ name, value })),
  };
}

// ─── CFPB-format pool (used as fallback for all views) ────────────────────────
// Generates rows spread over 90 days so all period windows (7D/30D/90D/180D) work
let _poolCounter = 5000;

export function generateCfpbPool(count = 600): SyntheticCfpbRow[] {
  const result: SyntheticCfpbRow[] = [];

  for (let i = 0; i < count; i++) {
    const prod     = wp(PRODUCTS,   PRODUCTS.map(p => p.w));
    const company  = wp(COMPANIES,  COMPANIES.map(c => c.w));
    const state    = wp(STATE_WTS.map(s => s[0]), STATE_WTS.map(s => s[1]));
    const response = wp(RESPONSES,  RESPONSES.map(r => r.w)).v;
    const disputed = Math.random() < 0.13;
    const untimely = response === 'Untimely response' || Math.random() < 0.07;

    let risk: SyntheticCfpbRow['risk'];
    if (response === 'Untimely response' || disputed) risk = 'CRITICAL';
    else if (untimely || response === 'Closed without relief') risk = 'HIGH';
    else if (response === 'In progress') risk = 'MEDIUM';
    else risk = 'LOW';

    // Spread dates: 40% last 7d, 35% 7-30d, 25% 30-90d
    const bucket = Math.random();
    const days = bucket < 0.40 ? Math.random() * 7
               : bucket < 0.75 ? 7  + Math.random() * 23
               :                  30 + Math.random() * 60;
    const d = new Date();
    d.setDate(d.getDate() - Math.floor(days));

    result.push({
      id:       `POOL-${String(++_poolCounter).padStart(6, '0')}`,
      date:     d.toISOString().slice(0, 10),
      product:  prod.name,
      company:  company.n,
      state,
      issue:    prod.issues[rnd(0, prod.issues.length - 1)],
      risk,
      disputed,
      untimely,
      source:   'synthetic_seed',
      channel:  wp(CHANNELS, CHANNEL_WTS),
      tags:     [risk.toLowerCase(), prod.regs[rnd(0, prod.regs.length - 1)]],
      company_response: response,
      timely:   untimely ? 'No' : 'Yes',
      narrative: prod.narratives[rnd(0, prod.narratives.length - 1)],
    });
  }

  return result.sort((a, b) => b.date.localeCompare(a.date));
}
