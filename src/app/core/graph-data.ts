import { GraphEdge, GraphNode, Passage } from './models';

/**
 * The leave-policy knowledge graph: World → North America → USA / MEX / CAN.
 *
 * Mirrors what the Neo4j database holds after ingestion. Figures reference
 * real statutes (FMLA, Ley Federal del Trabajo, Canada Labour Code) but the
 * company rules are illustrative — this is a demo corpus, not legal advice.
 */

const n = (
  id: string,
  label: GraphNode['label'],
  name: string,
  rest: Partial<GraphNode> = {},
): GraphNode => ({ id, label, name, ...rest });

export const NODES: GraphNode[] = [
  // ── Geography ──────────────────────────────────────────────────────────
  n('world', 'Region', 'World', { aliases: ['global', 'worldwide', 'company-wide', 'everywhere'], country: 'GLOBAL' }),
  n('na', 'Region', 'North America', { aliases: ['north america', 'na', 'americas'], country: 'GLOBAL' }),
  n('usa', 'Country', 'United States', { aliases: ['usa', 'us', 'united states', 'america', 'american', 'states'], country: 'USA', props: { iso: 'US', currency: 'USD', hqCity: 'New York' } }),
  n('mex', 'Country', 'Mexico', { aliases: ['mexico', 'mex', 'mx', 'mexican', 'méxico'], country: 'MEX', props: { iso: 'MX', currency: 'MXN', hqCity: 'Mexico City' } }),
  n('can', 'Country', 'Canada', { aliases: ['canada', 'can', 'ca', 'canadian', 'ontario', 'toronto'], country: 'CAN', props: { iso: 'CA', currency: 'CAD', hqCity: 'Toronto' } }),

  // ── Policies ───────────────────────────────────────────────────────────
  n('pol-global', 'Policy', 'Global Leave Policy v4.2', { aliases: ['global leave policy', 'global policy', 'group policy', 'baseline'], country: 'GLOBAL', props: { version: '4.2', effective: '2026-01-01', owner: 'Global HR' } }),
  n('pol-usa', 'Policy', 'US Leave Policy', { aliases: ['us leave policy', 'us policy', 'pto policy'], country: 'USA', props: { version: '2.1', effective: '2026-01-01', owner: 'HR Americas' } }),
  n('pol-mex', 'Policy', 'Mexico Leave Policy', { aliases: ['mexico leave policy', 'mexico policy', 'política de vacaciones'], country: 'MEX', props: { version: '3.0', effective: '2026-01-01', owner: 'HR LATAM' } }),
  n('pol-can', 'Policy', 'Canada Leave Policy', { aliases: ['canada leave policy', 'canada policy'], country: 'CAN', props: { version: '2.4', effective: '2026-01-01', owner: 'HR Canada' } }),

  // ── Leave types ────────────────────────────────────────────────────────
  n('lt-annual', 'LeaveType', 'Annual Leave', { aliases: ['annual leave', 'vacation', 'vacations', 'vacation days', 'pto', 'paid time off', 'holiday', 'holidays', 'time off', 'vacaciones', 'days off'], country: 'GLOBAL' }),
  n('lt-sick', 'LeaveType', 'Sick Leave', { aliases: ['sick', 'sick leave', 'sick days', 'illness', 'medical leave', 'incapacity', 'unwell', 'ill'], country: 'GLOBAL' }),
  n('lt-parental', 'LeaveType', 'Parental Leave', { aliases: ['parental', 'parental leave', 'maternity', 'maternity leave', 'paternity', 'paternity leave', 'baby', 'newborn', 'adoption', 'birth', 'new parent', 'mother', 'father'], country: 'GLOBAL' }),
  n('lt-bereavement', 'LeaveType', 'Bereavement Leave', { aliases: ['bereavement', 'compassionate', 'funeral', 'death in the family', 'passed away'], country: 'GLOBAL' }),
  n('lt-holidays', 'LeaveType', 'Public Holidays', { aliases: ['public holidays', 'statutory holidays', 'company holidays', 'bank holidays', 'general holidays'], country: 'GLOBAL' }),
  n('lt-jury', 'LeaveType', 'Jury & Civic Duty', { aliases: ['jury', 'jury duty', 'civic duty', 'voting', 'court'], country: 'GLOBAL' }),

  // ── Global rules ───────────────────────────────────────────────────────
  n('r-g-annual-min', 'Rule', 'Global annual leave floor', { country: 'GLOBAL', facets: ['entitlement'], aliases: ['minimum', 'floor', 'baseline entitlement'], props: { value: 15, unit: 'days/year' }, summary: 'Every full-time employee receives at least 15 working days of annual leave per year; country policies may grant more but never less.' }),
  n('r-g-carry', 'Rule', 'Global carryover rule', { country: 'GLOBAL', facets: ['carryover'], aliases: ['carryover', 'carry over', 'carry-over', 'unused', 'rollover', 'roll over', 'expire', 'lapse'], props: { value: 5, unit: 'days', deadline: '31 March' }, summary: 'Up to 5 unused annual leave days may be carried into the next year and must be used by 31 March, after which they lapse.' }),
  n('r-g-notice', 'Rule', 'Global notice period', { country: 'GLOBAL', facets: ['notice'], aliases: ['notice', 'notice period', 'advance notice', 'how far in advance', 'request', 'book'], props: { value: 2, unit: 'weeks', threshold: '5+ consecutive days' }, summary: 'Requests for 5 or more consecutive days need at least 2 weeks notice; shorter absences need 2 working days.' }),
  n('r-g-approval', 'Rule', 'Global approval chain', { country: 'GLOBAL', facets: ['approval'], aliases: ['approve', 'approves', 'approval', 'sign off', 'sign-off', 'authorise', 'authorize', 'who approves'], props: { managerLimit: 10, unit: 'days' }, summary: 'The line manager approves absences up to 10 consecutive days; anything longer, or any leave touching statutory entitlements, is co-approved by the HR Business Partner.' }),
  n('r-g-sick-cert', 'Rule', 'Global medical certificate rule', { country: 'GLOBAL', facets: ['eligibility', 'approval'], aliases: ['certificate', 'doctor', "doctor's note", 'medical certificate', 'sick note', 'proof'], props: { afterDays: 3 }, summary: 'A medical certificate is required for sick leave longer than 3 consecutive working days and must be uploaded within 48 hours of returning.' }),
  n('r-g-bereave', 'Rule', 'Global bereavement entitlement', { country: 'GLOBAL', facets: ['entitlement'], props: { value: 5, unit: 'days' }, summary: 'Employees receive 5 paid days of bereavement leave for an immediate family member and 2 days for extended family.' }),
  n('r-g-pt', 'Rule', 'Part-time pro-rating', { country: 'GLOBAL', facets: ['eligibility'], aliases: ['part-time', 'part time', 'pro-rata', 'prorated', 'pro rata'], summary: 'Part-time employees receive all leave entitlements pro-rated to contracted hours; contractors are outside the policy and follow their service agreement.' }),

  // ── USA rules ──────────────────────────────────────────────────────────
  n('r-us-pto', 'Rule', 'US PTO entitlement', { country: 'USA', facets: ['entitlement'], aliases: ['accrual', 'accrue', 'accrues'], props: { value: 20, unit: 'days/year', accrual: '1.67 days/month', after5Years: 25 }, summary: 'US employees accrue 20 PTO days per year at 1.67 days per month, rising to 25 days after 5 years of service.' }),
  n('r-us-carry', 'Rule', 'US PTO carryover', { country: 'USA', facets: ['carryover'], aliases: ['carryover', 'carry over', 'unused', 'rollover', 'payout', 'cash out'], props: { value: 10, unit: 'days' }, summary: 'US employees may carry over up to 10 PTO days with no deadline; unused PTO is paid out at termination only where state law requires it (for example California and Colorado).' }),
  n('r-us-sick', 'Rule', 'US paid sick leave', { country: 'USA', facets: ['entitlement'], props: { value: 10, unit: 'days/year', funding: 'front-loaded 1 January' }, summary: 'US employees receive 10 paid sick days per year, front-loaded on 1 January, in addition to PTO.' }),
  n('r-us-fmla', 'Rule', 'US FMLA job-protected leave', { country: 'USA', facets: ['entitlement', 'eligibility', 'regulation'], aliases: ['fmla', 'job protected', 'job-protected', 'serious health condition', 'unpaid leave'], props: { value: 12, unit: 'weeks', eligibility: '12 months service and 1,250 hours' }, summary: 'Under the FMLA, eligible US employees (12 months of service and 1,250 hours worked) may take up to 12 weeks of unpaid, job-protected leave per year for a serious health condition, a new child, or to care for a family member.' }),
  n('r-us-parental', 'Rule', 'US paid parental leave', { country: 'USA', facets: ['entitlement', 'pay'], props: { value: 12, unit: 'weeks', pay: '100%' }, summary: 'The US policy grants 12 weeks of fully paid parental leave to every new parent, running concurrently with FMLA where the employee is eligible.' }),
  n('r-us-sick-approval', 'Rule', 'US extended sick leave approval', { country: 'USA', facets: ['approval', 'eligibility'], aliases: ['approve', 'approval', 'extended sick', 'long sick'], props: { managerLimit: 3, unit: 'days' }, summary: 'In the US the line manager approves sick absences of up to 3 days; absences beyond 3 consecutive days require a medical certificate and HRBP approval, and absences beyond 5 days are assessed for FMLA designation.' }),
  n('r-us-holidays', 'Rule', 'US company holidays', { country: 'USA', facets: ['entitlement'], props: { value: 11, unit: 'days' }, summary: 'The US observes 11 paid company holidays, including the federal holidays and the day after Thanksgiving.' }),
  n('r-us-jury', 'Rule', 'US jury duty pay', { country: 'USA', facets: ['entitlement', 'pay'], props: { value: 10, unit: 'days', pay: '100%' }, summary: 'US employees summoned for jury duty are paid in full for up to 10 working days per year on presentation of the summons.' }),

  // ── Mexico rules ───────────────────────────────────────────────────────
  n('r-mx-vac', 'Rule', 'Mexico vacation entitlement', { country: 'MEX', facets: ['entitlement', 'regulation'], aliases: ['first year', 'year one', 'new employee', 'new hire', 'vacaciones dignas', 'seniority'], props: { value: 15, unit: 'days/year', statutory: 12, progression: '+2 per year to 20, then +2 every 5 years' }, summary: 'Mexico grants 15 working days of vacation in the first year of service, above the 12-day statutory minimum introduced by the 2023 "vacaciones dignas" reform of LFT Article 76, and the entitlement rises by 2 days per year until it reaches 20, then by 2 days every 5 years.' }),
  n('r-mx-prima', 'Rule', 'Mexico vacation premium', { country: 'MEX', facets: ['pay', 'regulation'], aliases: ['prima vacacional', 'vacation premium', 'premium', 'bonus', '25%'], props: { value: 25, unit: '%' }, summary: 'Vacation pay in Mexico carries a 25% vacation premium (prima vacacional) under LFT Article 80, paid with the salary for the vacation period.' }),
  n('r-mx-maternity', 'Rule', 'Mexico maternity leave', { country: 'MEX', facets: ['entitlement', 'pay', 'regulation'], aliases: ['maternity', 'maternidad', 'imss'], props: { value: 12, unit: 'weeks', split: '6 before + 6 after birth', pay: '100% via IMSS' }, summary: 'Mothers in Mexico receive 12 weeks of maternity leave at full pay (6 weeks before and 6 weeks after the birth, transferable with medical consent) funded through IMSS under LFT Article 170.' }),
  n('r-mx-paternity', 'Rule', 'Mexico paternity leave', { country: 'MEX', facets: ['entitlement', 'regulation'], aliases: ['paternity', 'paternidad', 'fathers'], props: { value: 5, unit: 'days', companyTopUp: 10 }, summary: 'Fathers in Mexico receive the 5 paid paternity days required by LFT Article 132 plus 5 additional company days, for 10 paid days in total.' }),
  n('r-mx-sick', 'Rule', 'Mexico sick leave (incapacidad)', { country: 'MEX', facets: ['entitlement', 'pay'], aliases: ['incapacidad', 'incapacity'], props: { imssFromDay: 4, imssPay: '60%', companyTopUp: '100% for 30 days' }, summary: 'Sick leave in Mexico is an IMSS incapacity: IMSS pays 60% of salary from the fourth day, and the company tops up to 100% for the first 30 days of each incapacity.' }),
  n('r-mx-carry', 'Rule', 'Mexico vacation timing', { country: 'MEX', facets: ['carryover', 'regulation'], aliases: ['carryover', 'carry over', 'unused', 'expire', 'within six months'], props: { window: '6 months after anniversary', carryover: 0 }, summary: 'In Mexico vacation must be taken within 6 months of the employment anniversary (LFT Article 81); it cannot be carried over or exchanged for pay while the employment continues.' }),
  n('r-mx-holidays', 'Rule', 'Mexico statutory holidays', { country: 'MEX', facets: ['entitlement', 'regulation'], props: { statutory: 8, company: 3 }, summary: 'Mexico observes the 8 statutory holidays listed in LFT Article 74 plus 3 company holidays.' }),

  // ── Canada rules ───────────────────────────────────────────────────────
  n('r-ca-vac', 'Rule', 'Canada vacation entitlement', { country: 'CAN', facets: ['entitlement', 'regulation'], aliases: ['vacation pay', '4%', '6%'], props: { value: 15, unit: 'days/year', after5Years: 20, statutory: '2 weeks (4%), 3 weeks after 5 years (6%)' }, summary: 'Canadian employees receive 15 vacation days per year, rising to 20 after 5 years, which exceeds the Canada Labour Code minimum of 2 weeks (3 weeks after 5 years, 4 weeks after 10).' }),
  n('r-ca-carry', 'Rule', 'Canada vacation carryover', { country: 'CAN', facets: ['carryover', 'regulation'], aliases: ['carryover', 'carry over', 'unused', 'rollover', '10 months'], props: { value: 5, unit: 'days', window: '10 months' }, summary: 'In Canada up to 5 unused vacation days may be carried over, but Ontario ESA section 35 requires each year\'s vacation to be taken within 10 months of the end of the vacation entitlement year.' }),
  n('r-ca-maternity', 'Rule', 'Canada maternity leave', { country: 'CAN', facets: ['entitlement', 'pay', 'regulation'], aliases: ['maternity', 'ei maternity'], props: { value: 17, unit: 'weeks', ei: '15 weeks at 55%' }, summary: 'Birth mothers in Canada may take 17 weeks of job-protected maternity leave, with Employment Insurance maternity benefits paying 55% of earnings for 15 weeks.' }),
  n('r-ca-parental', 'Rule', 'Canada parental leave', { country: 'CAN', facets: ['entitlement', 'pay', 'regulation'], aliases: ['ei parental', 'extended parental', 'standard parental', 'top-up', 'top up'], props: { value: 63, unit: 'weeks', eiStandard: '35 weeks at 55%', eiExtended: '61 weeks at 33%', topUp: '93% for 16 weeks' }, summary: 'Canadian parents may take up to 63 weeks of parental leave; Employment Insurance pays either 35 standard weeks at 55% or 61 extended weeks at 33%, and the company tops up to 93% of salary for the first 16 weeks.' }),
  n('r-ca-sick', 'Rule', 'Canada paid medical leave', { country: 'CAN', facets: ['entitlement', 'regulation'], aliases: ['medical leave', 'paid sick'], props: { value: 10, unit: 'days/year' }, summary: 'Federally regulated employees in Canada earn up to 10 paid medical leave days per year under Canada Labour Code section 239, and the company applies the same 10 days to all Canadian staff.' }),
  n('r-ca-bereave', 'Rule', 'Canada bereavement leave', { country: 'CAN', facets: ['entitlement', 'regulation'], props: { value: 10, unit: 'days', paid: 3 }, summary: 'Canada provides 10 days of bereavement leave, of which the first 3 are paid, in line with Canada Labour Code section 210.' }),
  n('r-ca-holidays', 'Rule', 'Canada general holidays', { country: 'CAN', facets: ['entitlement', 'regulation'], props: { federal: 10 }, summary: 'Canada observes the 10 federal general holidays plus any additional provincial holiday where the employee is based.' }),

  // ── Regulations ────────────────────────────────────────────────────────
  n('reg-fmla', 'Regulation', 'Family and Medical Leave Act (FMLA)', { aliases: ['fmla', 'family and medical leave act', 'federal law', 'us law'], country: 'USA', props: { jurisdiction: 'US federal', year: 1993 } }),
  n('reg-lft', 'Regulation', 'Ley Federal del Trabajo (LFT)', { aliases: ['lft', 'ley federal del trabajo', 'federal labour law', 'mexican labor law', 'labor law'], country: 'MEX', props: { jurisdiction: 'Mexico federal', reform: '2023 vacaciones dignas' } }),
  n('reg-imss', 'Regulation', 'IMSS Social Security Law', { aliases: ['imss', 'social security', 'seguro social'], country: 'MEX', props: { jurisdiction: 'Mexico federal' } }),
  n('reg-clc', 'Regulation', 'Canada Labour Code', { aliases: ['canada labour code', 'labour code', 'clc', 'federal code'], country: 'CAN', props: { jurisdiction: 'Canada federal' } }),
  n('reg-esa', 'Regulation', 'Ontario Employment Standards Act', { aliases: ['esa', 'employment standards act', 'ontario esa', 'provincial law'], country: 'CAN', props: { jurisdiction: 'Ontario' } }),
  n('reg-ei', 'Regulation', 'Employment Insurance Act', { aliases: ['ei', 'employment insurance', 'ei benefits'], country: 'CAN', props: { jurisdiction: 'Canada federal' } }),

  // ── Employee types & approvers ─────────────────────────────────────────
  n('et-ft', 'EmployeeType', 'Full-time employee', { aliases: ['full-time', 'full time', 'employee', 'employees', 'staff', 'permanent'], country: 'GLOBAL' }),
  n('et-pt', 'EmployeeType', 'Part-time employee', { aliases: ['part-time', 'part time'], country: 'GLOBAL' }),
  n('et-contract', 'EmployeeType', 'Contractor', { aliases: ['contractor', 'contractors', 'freelancer', 'vendor'], country: 'GLOBAL' }),
  n('ap-manager', 'Approver', 'Line Manager', { aliases: ['manager', 'line manager', 'supervisor', 'boss', 'team lead'], country: 'GLOBAL' }),
  n('ap-hrbp', 'Approver', 'HR Business Partner', { aliases: ['hrbp', 'hr business partner', 'hr', 'human resources', 'people partner'], country: 'GLOBAL' }),
];

// ─── Passages (document sections) ─────────────────────────────────────────

const p = (id: string, ref: string, title: string, breadcrumb: string, country: Passage['country'], text: string): Passage => ({
  id, ref, title, breadcrumb, country, text,
});

export const PASSAGES: Passage[] = [
  p('s-g-1', '§1.2', 'Scope and inheritance', 'Global Leave Policy v4.2 > 1 Purpose and scope > 1.2 Scope and inheritance', 'GLOBAL',
    'This policy sets the minimum leave standards for all entities of the group. Each country policy inherits every clause of this document and may only add to, never reduce, an entitlement. Where local law is more generous than this policy, local law prevails. Part-time employees receive all entitlements pro-rated to contracted hours. Contractors are outside the scope of this policy and follow their service agreement.'),
  p('s-g-3', '§3.1', 'Annual leave entitlement', 'Global Leave Policy v4.2 > 3 Annual leave > 3.1 Entitlement', 'GLOBAL',
    'Every full-time employee receives a minimum of 15 working days of annual leave per leave year, accrued monthly from the start date. Country policies define the actual entitlement, which may exceed but never fall below this floor. Public holidays are in addition to annual leave.'),
  p('s-g-32', '§3.2', 'Carryover and lapse', 'Global Leave Policy v4.2 > 3 Annual leave > 3.2 Carryover and lapse', 'GLOBAL',
    'Up to five (5) unused annual leave days may be carried into the following leave year. Carried-over days must be used by 31 March, after which they lapse without compensation unless local law requires payment. Country policies may extend this limit where statute demands it (see §3.2 of each country policy).'),
  p('s-g-33', '§3.3', 'Notice and approval', 'Global Leave Policy v4.2 > 3 Annual leave > 3.3 Notice and approval', 'GLOBAL',
    'Requests for five (5) or more consecutive working days must be submitted at least two (2) weeks in advance; shorter absences require two (2) working days notice. The line manager approves absences of up to ten (10) consecutive days. Absences longer than ten days, and any leave that draws on a statutory entitlement, require co-approval by the HR Business Partner (HRBP).'),
  p('s-g-4', '§4.1', 'Sick leave and medical certificates', 'Global Leave Policy v4.2 > 4 Sick leave > 4.1 Certification', 'GLOBAL',
    'Employees must notify their line manager before the start of their shift on the first day of absence. A medical certificate is required for any sick absence exceeding three (3) consecutive working days and must be uploaded to the HR portal within 48 hours of return. Sick leave is approved by the line manager; extended absences are managed with the HRBP under the country policy.'),
  p('s-g-5', '§5.1', 'Bereavement leave', 'Global Leave Policy v4.2 > 5 Other leave > 5.1 Bereavement', 'GLOBAL',
    'Employees receive five (5) paid working days of bereavement leave on the death of an immediate family member (spouse or partner, child, parent, sibling) and two (2) paid days for extended family. Additional unpaid time may be agreed with the line manager.'),

  p('s-us-2', '§2.1', 'PTO accrual', 'US Leave Policy v2.1 > 2 Paid time off > 2.1 Accrual', 'USA',
    'Regular full-time employees accrue twenty (20) days of paid time off (PTO) per calendar year at a rate of 1.67 days per month. Employees with five (5) or more years of continuous service accrue twenty-five (25) days. PTO covers vacation and personal days; sick leave is tracked separately under §3.'),
  p('s-us-22', '§2.2', 'PTO carryover and payout', 'US Leave Policy v2.1 > 2 Paid time off > 2.2 Carryover and payout', 'USA',
    'This section overrides §3.2 of the Global Leave Policy. Employees may carry over up to ten (10) unused PTO days into the next calendar year with no use-by deadline. Accrued, unused PTO is paid out at separation only where state law requires it (for example California, Colorado, Illinois and Montana); in all other states unused PTO is forfeited at separation.'),
  p('s-us-3', '§3.1', 'Paid sick leave', 'US Leave Policy v2.1 > 3 Sick leave > 3.1 Entitlement and approval', 'USA',
    'Employees receive ten (10) paid sick days per year, front-loaded on 1 January and pro-rated for mid-year starters. The line manager approves sick absences of up to three (3) days. Absences of more than three consecutive days require a medical certificate (Global §4.1) and HRBP approval. Any absence expected to exceed five (5) days is reviewed by the HRBP for FMLA designation.'),
  p('s-us-4', '§4.1', 'Family and Medical Leave Act', 'US Leave Policy v2.1 > 4 Statutory leave > 4.1 FMLA', 'USA',
    'Employees who have completed twelve (12) months of service and worked at least 1,250 hours in the preceding year are eligible for up to twelve (12) weeks of unpaid, job-protected leave per rolling 12-month period under the Family and Medical Leave Act for their own serious health condition, the birth or placement of a child, or to care for a spouse, child or parent with a serious health condition. Group health benefits continue during FMLA leave.'),
  p('s-us-5', '§5.1', 'Paid parental leave', 'US Leave Policy v2.1 > 5 Parental leave > 5.1 Entitlement', 'USA',
    'All new parents, regardless of gender or how they became a parent, receive twelve (12) weeks of parental leave at 100% of base pay, to be taken within twelve months of the birth or placement. Paid parental leave runs concurrently with FMLA leave where the employee is FMLA-eligible. Requests are approved by the HRBP.'),
  p('s-us-6', '§6.1', 'Company holidays and jury duty', 'US Leave Policy v2.1 > 6 Other leave > 6.1 Holidays and civic duty', 'USA',
    'The company observes eleven (11) paid holidays per year, including all federal holidays and the day after Thanksgiving. Employees summoned for jury duty are paid their full base salary for up to ten (10) working days per year on presentation of the summons.'),

  p('s-mx-2', '§2.1', 'Vacation entitlement (vacaciones)', 'Mexico Leave Policy v3.0 > 2 Vacaciones > 2.1 Entitlement', 'MEX',
    'From the first anniversary of service, employees are entitled to fifteen (15) working days of vacation, three days above the twelve-day statutory minimum established by the 2023 "vacaciones dignas" reform of Article 76 of the Ley Federal del Trabajo (LFT). The entitlement increases by two (2) days for each subsequent year of service until it reaches twenty (20) days, and thereafter by two (2) days for every five (5) years of service. The company allows new employees to take vacation in advance during their first year, pro-rated to months worked.'),
  p('s-mx-22', '§2.2', 'Vacation premium (prima vacacional)', 'Mexico Leave Policy v3.0 > 2 Vacaciones > 2.2 Vacation premium', 'MEX',
    'In accordance with LFT Article 80, vacation pay carries a vacation premium (prima vacacional) of twenty-five percent (25%) of the salary corresponding to the vacation period. The premium is paid with the payroll in which the vacation is taken.'),
  p('s-mx-23', '§2.3', 'Timing of vacation', 'Mexico Leave Policy v3.0 > 2 Vacaciones > 2.3 Timing and carryover', 'MEX',
    'This section overrides §3.2 of the Global Leave Policy. Under LFT Article 81, vacation must be granted within six (6) months following the anniversary of service. Vacation days cannot be carried over beyond that window and cannot be exchanged for payment while the employment relationship continues; accrued vacation is paid out only on termination.'),
  p('s-mx-3', '§3.1', 'Maternity and paternity leave', 'Mexico Leave Policy v3.0 > 3 Parental leave > 3.1 Maternity and paternity', 'MEX',
    'Mothers receive twelve (12) weeks of maternity leave at full salary, six (6) weeks before and six (6) weeks after the birth, funded by IMSS under LFT Article 170; up to four of the pre-natal weeks may be transferred to the post-natal period with medical approval. Fathers receive the five (5) paid paternity days required by LFT Article 132 section XXVII bis plus five (5) additional company-paid days, for a total of ten (10) working days.'),
  p('s-mx-4', '§4.1', 'Incapacity (sick leave)', 'Mexico Leave Policy v3.0 > 4 Incapacidad > 4.1 Pay during incapacity', 'MEX',
    'Sick absence is managed as an IMSS incapacity certificate (incapacidad). IMSS pays sixty percent (60%) of the registered salary from the fourth day of a general illness. The company tops up pay to one hundred percent (100%) for the first thirty (30) calendar days of each incapacity and pays the first three days in full.'),
  p('s-mx-5', '§5.1', 'Statutory and company holidays', 'Mexico Leave Policy v3.0 > 5 Días festivos > 5.1 Holidays', 'MEX',
    'Employees observe the eight (8) mandatory rest days listed in LFT Article 74 and three (3) additional company holidays announced each December.'),

  p('s-ca-2', '§2.1', 'Vacation entitlement', 'Canada Leave Policy v2.4 > 2 Vacation > 2.1 Entitlement', 'CAN',
    'Employees receive fifteen (15) vacation days per year, rising to twenty (20) days after five (5) years of continuous service. This exceeds the Canada Labour Code minimum of two weeks (4% vacation pay), three weeks after five years (6%) and four weeks after ten years (8%). Vacation pay is calculated on gross wages for the entitlement year.'),
  p('s-ca-22', '§2.2', 'Carryover', 'Canada Leave Policy v2.4 > 2 Vacation > 2.2 Carryover', 'CAN',
    'This section applies Global §3.2 with a provincial constraint. Up to five (5) unused vacation days may be carried into the next entitlement year. For Ontario-based employees, section 35 of the Employment Standards Act requires that each year\'s vacation be taken within ten (10) months of the end of the vacation entitlement year; carried-over days must therefore be scheduled before that deadline.'),
  p('s-ca-3', '§3.1', 'Maternity and parental leave', 'Canada Leave Policy v2.4 > 3 Parental leave > 3.1 Maternity and parental', 'CAN',
    'Birth mothers may take up to seventeen (17) weeks of job-protected maternity leave. Any parent may take parental leave of up to sixty-three (63) weeks, which may be shared. Employment Insurance (EI) maternity benefits pay 55% of average insurable earnings for 15 weeks; EI parental benefits are either standard (35 weeks at 55%) or extended (61 weeks at 33%). The company tops up EI benefits to ninety-three percent (93%) of base salary for the first sixteen (16) weeks of combined maternity and parental leave.'),
  p('s-ca-4', '§4.1', 'Paid medical leave', 'Canada Leave Policy v2.4 > 4 Medical leave > 4.1 Entitlement', 'CAN',
    'Under section 239 of the Canada Labour Code, federally regulated employees earn three days of paid medical leave after 30 days of employment and one further day per month up to ten (10) days per year. The company grants the same ten (10) paid medical leave days to all Canadian employees regardless of regulatory status. A medical certificate may be requested for absences of five or more consecutive days.'),
  p('s-ca-5', '§5.1', 'Bereavement and general holidays', 'Canada Leave Policy v2.4 > 5 Other leave > 5.1 Bereavement and holidays', 'CAN',
    'Employees may take up to ten (10) days of bereavement leave, the first three (3) of which are paid, consistent with section 210 of the Canada Labour Code. The company observes the ten (10) federal general holidays and any additional statutory holiday in the employee\'s province.'),
];

// ─── Edges ────────────────────────────────────────────────────────────────

let edgeSeq = 0;
const e = (source: string, relation: GraphEdge['relation'], target: string, sectionId?: string, confidence = 0.95): GraphEdge => ({
  id: `e${++edgeSeq}`,
  source,
  target,
  relation,
  confidence,
  sectionId,
});

export const EDGES: GraphEdge[] = [
  // Geography
  e('na', 'PART_OF', 'world', undefined, 1),
  e('usa', 'PART_OF', 'na', undefined, 1),
  e('mex', 'PART_OF', 'na', undefined, 1),
  e('can', 'PART_OF', 'na', undefined, 1),

  // Policies
  e('world', 'HAS_POLICY', 'pol-global', 's-g-1', 1),
  e('usa', 'HAS_POLICY', 'pol-usa', 's-g-1', 1),
  e('mex', 'HAS_POLICY', 'pol-mex', 's-g-1', 1),
  e('can', 'HAS_POLICY', 'pol-can', 's-g-1', 1),
  e('pol-usa', 'INHERITS_FROM', 'pol-global', 's-g-1', 0.98),
  e('pol-mex', 'INHERITS_FROM', 'pol-global', 's-g-1', 0.98),
  e('pol-can', 'INHERITS_FROM', 'pol-global', 's-g-1', 0.98),

  // Coverage
  e('pol-global', 'COVERS', 'lt-annual', 's-g-3'),
  e('pol-global', 'COVERS', 'lt-sick', 's-g-4'),
  e('pol-global', 'COVERS', 'lt-bereavement', 's-g-5'),
  e('pol-global', 'COVERS', 'lt-parental', 's-g-1', 0.9),
  e('pol-global', 'COVERS', 'lt-holidays', 's-g-3', 0.9),
  e('pol-global', 'COVERS', 'lt-jury', 's-g-1', 0.85),
  e('pol-usa', 'COVERS', 'lt-annual', 's-us-2'),
  e('pol-usa', 'COVERS', 'lt-sick', 's-us-3'),
  e('pol-usa', 'COVERS', 'lt-parental', 's-us-5'),
  e('pol-usa', 'COVERS', 'lt-holidays', 's-us-6'),
  e('pol-usa', 'COVERS', 'lt-jury', 's-us-6'),
  e('pol-mex', 'COVERS', 'lt-annual', 's-mx-2'),
  e('pol-mex', 'COVERS', 'lt-sick', 's-mx-4'),
  e('pol-mex', 'COVERS', 'lt-parental', 's-mx-3'),
  e('pol-mex', 'COVERS', 'lt-holidays', 's-mx-5'),
  e('pol-can', 'COVERS', 'lt-annual', 's-ca-2'),
  e('pol-can', 'COVERS', 'lt-sick', 's-ca-4'),
  e('pol-can', 'COVERS', 'lt-parental', 's-ca-3'),
  e('pol-can', 'COVERS', 'lt-bereavement', 's-ca-5'),
  e('pol-can', 'COVERS', 'lt-holidays', 's-ca-5'),

  // Global rules
  e('lt-annual', 'HAS_RULE', 'r-g-annual-min', 's-g-3'),
  e('lt-annual', 'HAS_RULE', 'r-g-carry', 's-g-32'),
  e('lt-annual', 'HAS_RULE', 'r-g-notice', 's-g-33'),
  e('lt-annual', 'HAS_RULE', 'r-g-approval', 's-g-33'),
  e('lt-sick', 'HAS_RULE', 'r-g-sick-cert', 's-g-4'),
  e('lt-bereavement', 'HAS_RULE', 'r-g-bereave', 's-g-5'),
  e('pol-global', 'HAS_RULE', 'r-g-pt', 's-g-1'),
  e('r-g-approval', 'APPROVED_BY', 'ap-manager', 's-g-33'),
  e('r-g-approval', 'APPROVED_BY', 'ap-hrbp', 's-g-33'),
  e('r-g-sick-cert', 'APPROVED_BY', 'ap-manager', 's-g-4'),
  e('r-g-pt', 'APPLIES_TO', 'et-pt', 's-g-1'),
  e('r-g-annual-min', 'APPLIES_TO', 'et-ft', 's-g-3'),

  // USA rules
  e('lt-annual', 'HAS_RULE', 'r-us-pto', 's-us-2'),
  e('lt-annual', 'HAS_RULE', 'r-us-carry', 's-us-22'),
  e('lt-sick', 'HAS_RULE', 'r-us-sick', 's-us-3'),
  e('lt-sick', 'HAS_RULE', 'r-us-sick-approval', 's-us-3'),
  e('lt-sick', 'HAS_RULE', 'r-us-fmla', 's-us-4', 0.9),
  e('lt-parental', 'HAS_RULE', 'r-us-parental', 's-us-5'),
  e('lt-parental', 'HAS_RULE', 'r-us-fmla', 's-us-4', 0.9),
  e('lt-holidays', 'HAS_RULE', 'r-us-holidays', 's-us-6'),
  e('lt-jury', 'HAS_RULE', 'r-us-jury', 's-us-6'),
  e('r-us-pto', 'OVERRIDES', 'r-g-annual-min', 's-us-2', 0.92),
  e('r-us-carry', 'OVERRIDES', 'r-g-carry', 's-us-22'),
  e('r-us-fmla', 'GOVERNED_BY', 'reg-fmla', 's-us-4', 1),
  e('r-us-parental', 'GOVERNED_BY', 'reg-fmla', 's-us-5', 0.8),
  e('r-us-sick-approval', 'APPROVED_BY', 'ap-manager', 's-us-3'),
  e('r-us-sick-approval', 'APPROVED_BY', 'ap-hrbp', 's-us-3'),
  e('r-us-parental', 'APPROVED_BY', 'ap-hrbp', 's-us-5'),
  e('r-us-fmla', 'APPLIES_TO', 'et-ft', 's-us-4'),
  e('r-us-pto', 'APPLIES_TO', 'et-ft', 's-us-2'),
  ...['r-us-pto', 'r-us-carry', 'r-us-sick', 'r-us-sick-approval', 'r-us-fmla', 'r-us-parental', 'r-us-holidays', 'r-us-jury'].map((r) => e('pol-usa', 'HAS_RULE', r, undefined, 0.97)),

  // Mexico rules
  e('lt-annual', 'HAS_RULE', 'r-mx-vac', 's-mx-2'),
  e('lt-annual', 'HAS_RULE', 'r-mx-prima', 's-mx-22'),
  e('lt-annual', 'HAS_RULE', 'r-mx-carry', 's-mx-23'),
  e('lt-parental', 'HAS_RULE', 'r-mx-maternity', 's-mx-3'),
  e('lt-parental', 'HAS_RULE', 'r-mx-paternity', 's-mx-3'),
  e('lt-sick', 'HAS_RULE', 'r-mx-sick', 's-mx-4'),
  e('lt-holidays', 'HAS_RULE', 'r-mx-holidays', 's-mx-5'),
  e('r-mx-carry', 'OVERRIDES', 'r-g-carry', 's-mx-23'),
  e('r-mx-vac', 'GOVERNED_BY', 'reg-lft', 's-mx-2', 1),
  e('r-mx-prima', 'GOVERNED_BY', 'reg-lft', 's-mx-22', 1),
  e('r-mx-carry', 'GOVERNED_BY', 'reg-lft', 's-mx-23', 1),
  e('r-mx-maternity', 'GOVERNED_BY', 'reg-lft', 's-mx-3', 1),
  e('r-mx-maternity', 'GOVERNED_BY', 'reg-imss', 's-mx-3', 0.95),
  e('r-mx-paternity', 'GOVERNED_BY', 'reg-lft', 's-mx-3', 1),
  e('r-mx-sick', 'GOVERNED_BY', 'reg-imss', 's-mx-4', 1),
  e('r-mx-holidays', 'GOVERNED_BY', 'reg-lft', 's-mx-5', 1),
  e('r-mx-vac', 'APPLIES_TO', 'et-ft', 's-mx-2'),
  e('r-mx-maternity', 'APPROVED_BY', 'ap-hrbp', 's-mx-3', 0.9),
  ...['r-mx-vac', 'r-mx-prima', 'r-mx-carry', 'r-mx-maternity', 'r-mx-paternity', 'r-mx-sick', 'r-mx-holidays'].map((r) => e('pol-mex', 'HAS_RULE', r, undefined, 0.97)),

  // Canada rules
  e('lt-annual', 'HAS_RULE', 'r-ca-vac', 's-ca-2'),
  e('lt-annual', 'HAS_RULE', 'r-ca-carry', 's-ca-22'),
  e('lt-parental', 'HAS_RULE', 'r-ca-maternity', 's-ca-3'),
  e('lt-parental', 'HAS_RULE', 'r-ca-parental', 's-ca-3'),
  e('lt-sick', 'HAS_RULE', 'r-ca-sick', 's-ca-4'),
  e('lt-bereavement', 'HAS_RULE', 'r-ca-bereave', 's-ca-5'),
  e('lt-holidays', 'HAS_RULE', 'r-ca-holidays', 's-ca-5'),
  e('r-ca-carry', 'OVERRIDES', 'r-g-carry', 's-ca-22', 0.9),
  e('r-ca-bereave', 'OVERRIDES', 'r-g-bereave', 's-ca-5', 0.9),
  e('r-ca-vac', 'GOVERNED_BY', 'reg-clc', 's-ca-2', 1),
  e('r-ca-carry', 'GOVERNED_BY', 'reg-esa', 's-ca-22', 1),
  e('r-ca-maternity', 'GOVERNED_BY', 'reg-clc', 's-ca-3', 0.95),
  e('r-ca-maternity', 'GOVERNED_BY', 'reg-ei', 's-ca-3', 1),
  e('r-ca-parental', 'GOVERNED_BY', 'reg-ei', 's-ca-3', 1),
  e('r-ca-sick', 'GOVERNED_BY', 'reg-clc', 's-ca-4', 1),
  e('r-ca-bereave', 'GOVERNED_BY', 'reg-clc', 's-ca-5', 1),
  e('r-ca-vac', 'APPLIES_TO', 'et-ft', 's-ca-2'),
  e('r-ca-parental', 'APPROVED_BY', 'ap-hrbp', 's-ca-3', 0.9),
  ...['r-ca-vac', 'r-ca-carry', 'r-ca-maternity', 'r-ca-parental', 'r-ca-sick', 'r-ca-bereave', 'r-ca-holidays'].map((r) => e('pol-can', 'HAS_RULE', r, undefined, 0.97)),

  // Section citations (rules → sections) for CITED_IN traversal
  ...([
    ['r-g-annual-min', 's-g-3'], ['r-g-carry', 's-g-32'], ['r-g-notice', 's-g-33'], ['r-g-approval', 's-g-33'], ['r-g-sick-cert', 's-g-4'], ['r-g-bereave', 's-g-5'], ['r-g-pt', 's-g-1'],
    ['r-us-pto', 's-us-2'], ['r-us-carry', 's-us-22'], ['r-us-sick', 's-us-3'], ['r-us-sick-approval', 's-us-3'], ['r-us-fmla', 's-us-4'], ['r-us-parental', 's-us-5'], ['r-us-holidays', 's-us-6'], ['r-us-jury', 's-us-6'],
    ['r-mx-vac', 's-mx-2'], ['r-mx-prima', 's-mx-22'], ['r-mx-carry', 's-mx-23'], ['r-mx-maternity', 's-mx-3'], ['r-mx-paternity', 's-mx-3'], ['r-mx-sick', 's-mx-4'], ['r-mx-holidays', 's-mx-5'],
    ['r-ca-vac', 's-ca-2'], ['r-ca-carry', 's-ca-22'], ['r-ca-maternity', 's-ca-3'], ['r-ca-parental', 's-ca-3'], ['r-ca-sick', 's-ca-4'], ['r-ca-bereave', 's-ca-5'], ['r-ca-holidays', 's-ca-5'],
  ] as const).map(([r, s]) => e(r, 'CITED_IN', s, s, 1)),
];

/** Section nodes are derived from passages so the graph can show CITED_IN edges. */
export const SECTION_NODES: GraphNode[] = PASSAGES.map((s) => ({
  id: s.id,
  label: 'Section',
  name: `${s.ref} ${s.title}`,
  country: s.country,
  props: { breadcrumb: s.breadcrumb },
}));

export const ALL_NODES: GraphNode[] = [...NODES, ...SECTION_NODES];

export const NODE_BY_ID: ReadonlyMap<string, GraphNode> = new Map(ALL_NODES.map((x) => [x.id, x]));
export const PASSAGE_BY_ID: ReadonlyMap<string, Passage> = new Map(PASSAGES.map((x) => [x.id, x]));

export const SUGGESTED_QUESTIONS: string[] = [
  'How many vacation days does a new full-time employee in Mexico get?',
  'Compare parental leave in the USA, Mexico and Canada.',
  'What is the carryover rule for unused annual leave in Canada?',
  'Who approves sick leave longer than three days in the USA?',
  'Which regulations govern leave in Mexico?',
  'How much notice do I need to give for two weeks of annual leave?',
];

/** Fluorescent palette for the near-black graph canvas (validated: chroma, CVD separation, contrast). */
export const LABEL_COLORS: Record<GraphNode['label'], string> = {
  Region: '#b26bff',
  Country: '#00e5ff',
  Policy: '#ffb000',
  LeaveType: '#2bff88',
  Rule: '#ff2d95',
  Regulation: '#ff6a00',
  EmployeeType: '#4d8bff',
  Approver: '#ffe600',
  Section: '#8a94b8',
};
