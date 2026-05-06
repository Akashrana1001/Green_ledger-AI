/* ── 9 SEBI NGRBC Principles ─────────────────────────────────────────────
 * Each principle maps to the BRSR document categories that supply its data.
 * This constant drives both the Admin's principle-assignment UI and the
 * exclusion logic that prevents two team members owning the same principle.
 * ─────────────────────────────────────────────────────────────────────── */

export const BRSR_PRINCIPLES = [
  {
    id: 'P1',
    name: 'Ethics, Transparency & Accountability',
    short: 'Ethics',
    icon: 'gavel',
    ngrbc: 'Principle 1',
    categories: ['governance_report', 'cyber_security_log'],
  },
  {
    id: 'P2',
    name: 'Products & Services Sustainability',
    short: 'Products',
    icon: 'inventory',
    ngrbc: 'Principle 2',
    categories: ['supplier_msme_cert', 'consumer_complaints'],
  },
  {
    id: 'P3',
    name: 'Employee Wellbeing',
    short: 'Wellbeing',
    icon: 'favorite',
    ngrbc: 'Principle 3',
    categories: ['hr_wages_data', 'posh_records', 'safety_incidents_log', 'employee_benefits', 'workforce_records'],
  },
  {
    id: 'P4',
    name: 'Stakeholder Engagement',
    short: 'Stakeholders',
    icon: 'groups',
    ngrbc: 'Principle 4',
    categories: ['governance_report'],
  },
  {
    id: 'P5',
    name: 'Human Rights',
    short: 'Human Rights',
    icon: 'handshake',
    ngrbc: 'Principle 5',
    categories: ['hr_wages_data', 'workforce_records'],
  },
  {
    id: 'P6',
    name: 'Environmental Responsibility',
    short: 'Environment',
    icon: 'eco',
    ngrbc: 'Principle 6',
    categories: ['electricity_bill', 'fuel_consumption', 'water_usage', 'waste_records', 'air_emissions_log', 'scope3_emissions_data', 'financial_statements'],
  },
  {
    id: 'P7',
    name: 'Policy Advocacy',
    short: 'Advocacy',
    icon: 'campaign',
    ngrbc: 'Principle 7',
    categories: ['governance_report'],
  },
  {
    id: 'P8',
    name: 'Inclusive Growth & Equitable Dev.',
    short: 'Inclusion',
    icon: 'diversity_3',
    ngrbc: 'Principle 8',
    categories: ['supplier_msme_cert', 'accounts_payable'],
  },
  {
    id: 'P9',
    name: 'Consumer Responsibility',
    short: 'Consumer',
    icon: 'person_pin',
    ngrbc: 'Principle 9',
    categories: ['consumer_complaints', 'cyber_security_log'],
  },
];
