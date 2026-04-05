/**
 * Demo HR API — public, no auth required.
 * Use this as an API Connector in Mouna AI for testing employee / attrition analysis.
 *
 * Base URL  : https://your-domain/api/v1/demo/hr
 * Endpoints :
 *   GET /terminated   — employees who left, with reason & details
 *   GET /active       — currently active employees
 *   GET /departments  — department list with headcount & turnover rate
 *   GET /summary      — aggregated attrition stats
 */

import { Router, type Router as ExpressRouter, type Request, type Response } from 'express';

export const demoHrRouter: ExpressRouter = Router();

// ── Static mock dataset ───────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: 'D01', name: 'Engineering',  headcount: 24, turnover_rate_pct: 12 },
  { id: 'D02', name: 'Sales',         headcount: 18, turnover_rate_pct: 28 },
  { id: 'D03', name: 'Customer Support', headcount: 15, turnover_rate_pct: 34 },
  { id: 'D04', name: 'HR & People',   headcount: 6,  turnover_rate_pct: 8  },
  { id: 'D05', name: 'Finance',       headcount: 9,  turnover_rate_pct: 6  },
  { id: 'D06', name: 'Marketing',     headcount: 11, turnover_rate_pct: 18 },
  { id: 'D07', name: 'Operations',    headcount: 20, turnover_rate_pct: 15 },
];

const TERMINATION_REASONS = [
  'Better opportunity elsewhere',
  'Compensation below market',
  'Lack of career growth',
  'Poor management',
  'Work-life balance',
  'Relocation',
  'Personal reasons',
  'Company restructuring / redundancy',
  'Performance issues',
  'Contract ended',
];

const TERMINATED_EMPLOYEES = [
  { id: 'E001', name: 'Priya Sharma',       department: 'Sales',           role: 'Sales Executive',         tenure_months: 14, termination_date: '2025-11-15', termination_reason: 'Better opportunity elsewhere',   exit_interview_score: 3, voluntary: true },
  { id: 'E002', name: 'James Okafor',        department: 'Customer Support',role: 'Support Agent',           tenure_months: 8,  termination_date: '2025-11-28', termination_reason: 'Compensation below market',        exit_interview_score: 2, voluntary: true },
  { id: 'E003', name: 'Li Wei',              department: 'Engineering',     role: 'Junior Developer',        tenure_months: 6,  termination_date: '2025-12-03', termination_reason: 'Lack of career growth',             exit_interview_score: 3, voluntary: true },
  { id: 'E004', name: 'Amara Diallo',        department: 'Sales',           role: 'Account Manager',         tenure_months: 22, termination_date: '2025-12-10', termination_reason: 'Poor management',                   exit_interview_score: 1, voluntary: true },
  { id: 'E005', name: 'Carlos Mendez',       department: 'Marketing',       role: 'Marketing Coordinator',   tenure_months: 31, termination_date: '2025-12-19', termination_reason: 'Work-life balance',                  exit_interview_score: 4, voluntary: true },
  { id: 'E006', name: 'Sarah Mitchell',      department: 'Customer Support',role: 'Support Team Lead',       tenure_months: 9,  termination_date: '2026-01-07', termination_reason: 'Better opportunity elsewhere',   exit_interview_score: 4, voluntary: true },
  { id: 'E007', name: 'Rajan Patel',         department: 'Operations',      role: 'Logistics Coordinator',   tenure_months: 4,  termination_date: '2026-01-14', termination_reason: 'Performance issues',                exit_interview_score: null, voluntary: false },
  { id: 'E008', name: 'Emily Thornton',      department: 'Finance',         role: 'Financial Analyst',       tenure_months: 44, termination_date: '2026-01-20', termination_reason: 'Relocation',                        exit_interview_score: 5, voluntary: true },
  { id: 'E009', name: 'Mohammed Al-Farsi',   department: 'Sales',           role: 'Sales Executive',         tenure_months: 7,  termination_date: '2026-01-26', termination_reason: 'Compensation below market',        exit_interview_score: 2, voluntary: true },
  { id: 'E010', name: 'Ngozi Eze',           department: 'Customer Support',role: 'Support Agent',           tenure_months: 11, termination_date: '2026-02-04', termination_reason: 'Poor management',                   exit_interview_score: 2, voluntary: true },
  { id: 'E011', name: 'Tom Baker',           department: 'Engineering',     role: 'Backend Engineer',        tenure_months: 18, termination_date: '2026-02-11', termination_reason: 'Better opportunity elsewhere',   exit_interview_score: 4, voluntary: true },
  { id: 'E012', name: 'Deepika Nair',        department: 'HR & People',     role: 'HR Coordinator',          tenure_months: 38, termination_date: '2026-02-18', termination_reason: 'Personal reasons',                  exit_interview_score: 5, voluntary: true },
  { id: 'E013', name: 'Samuel Osei',         department: 'Customer Support',role: 'Support Agent',           tenure_months: 5,  termination_date: '2026-02-25', termination_reason: 'Work-life balance',                  exit_interview_score: 3, voluntary: true },
  { id: 'E014', name: 'Ana Lima',            department: 'Marketing',       role: 'Content Specialist',      tenure_months: 15, termination_date: '2026-03-03', termination_reason: 'Lack of career growth',             exit_interview_score: 3, voluntary: true },
  { id: 'E015', name: 'Viktor Sokolov',      department: 'Operations',      role: 'Operations Analyst',      tenure_months: 27, termination_date: '2026-03-10', termination_reason: 'Company restructuring / redundancy', exit_interview_score: null, voluntary: false },
  { id: 'E016', name: 'Fatima Hassan',       department: 'Sales',           role: 'Sales Manager',           tenure_months: 33, termination_date: '2026-03-17', termination_reason: 'Better opportunity elsewhere',   exit_interview_score: 4, voluntary: true },
  { id: 'E017', name: 'David Chen',          department: 'Engineering',     role: 'DevOps Engineer',         tenure_months: 12, termination_date: '2026-03-24', termination_reason: 'Compensation below market',        exit_interview_score: 3, voluntary: true },
  { id: 'E018', name: 'Oluwaseun Adeyemi',   department: 'Customer Support',role: 'Support Agent',           tenure_months: 3,  termination_date: '2026-03-28', termination_reason: 'Contract ended',                    exit_interview_score: null, voluntary: false },
  { id: 'E019', name: 'Rebecca Walsh',       department: 'Finance',         role: 'Accounts Analyst',        tenure_months: 19, termination_date: '2026-04-01', termination_reason: 'Poor management',                   exit_interview_score: 2, voluntary: true },
  { id: 'E020', name: 'Kenji Tanaka',        department: 'Marketing',       role: 'Digital Marketing Lead',  tenure_months: 41, termination_date: '2026-04-02', termination_reason: 'Work-life balance',                  exit_interview_score: 3, voluntary: true },
];

const ACTIVE_EMPLOYEES = [
  { id: 'A001', name: 'Alice Johnson',     department: 'Engineering',     role: 'Senior Developer',         tenure_months: 36, status: 'active', performance_score: 4.5, satisfaction_score: 4.1, at_risk: false },
  { id: 'A002', name: 'Brian Kowalski',    department: 'Sales',           role: 'Sales Executive',          tenure_months: 8,  status: 'active', performance_score: 3.2, satisfaction_score: 2.8, at_risk: true  },
  { id: 'A003', name: 'Chen Xiulan',       department: 'Customer Support',role: 'Support Team Lead',        tenure_months: 24, status: 'active', performance_score: 4.1, satisfaction_score: 3.9, at_risk: false },
  { id: 'A004', name: 'Diana Osei',        department: 'HR & People',     role: 'HR Manager',               tenure_months: 52, status: 'active', performance_score: 4.8, satisfaction_score: 4.5, at_risk: false },
  { id: 'A005', name: 'Ethan Brown',       department: 'Finance',         role: 'Finance Manager',          tenure_months: 61, status: 'active', performance_score: 4.4, satisfaction_score: 4.2, at_risk: false },
  { id: 'A006', name: 'Fiona MacLeod',     department: 'Marketing',       role: 'Marketing Manager',        tenure_months: 29, status: 'active', performance_score: 4.0, satisfaction_score: 3.6, at_risk: false },
  { id: 'A007', name: 'George Mensah',     department: 'Operations',      role: 'Operations Manager',       tenure_months: 44, status: 'active', performance_score: 4.3, satisfaction_score: 4.0, at_risk: false },
  { id: 'A008', name: 'Hannah Yip',        department: 'Engineering',     role: 'Frontend Engineer',        tenure_months: 15, status: 'active', performance_score: 3.8, satisfaction_score: 2.9, at_risk: true  },
  { id: 'A009', name: 'Ivan Petrov',       department: 'Sales',           role: 'Account Manager',          tenure_months: 9,  status: 'active', performance_score: 3.1, satisfaction_score: 2.5, at_risk: true  },
  { id: 'A010', name: 'Jasmine Okonkwo',   department: 'Customer Support',role: 'Support Agent',            tenure_months: 6,  status: 'active', performance_score: 3.5, satisfaction_score: 2.7, at_risk: true  },
];

// ── Endpoints ─────────────────────────────────────────────────────────────────

// GET /demo/hr/terminated
demoHrRouter.get('/terminated', (_req: Request, res: Response) => {
  res.json({
    total: TERMINATED_EMPLOYEES.length,
    data: TERMINATED_EMPLOYEES,
    meta: {
      description: 'Employees who have left the organisation in the past 6 months',
      available_reasons: TERMINATION_REASONS,
    },
  });
});

// GET /demo/hr/active
demoHrRouter.get('/active', (_req: Request, res: Response) => {
  res.json({
    total: ACTIVE_EMPLOYEES.length,
    data: ACTIVE_EMPLOYEES,
    meta: {
      description: 'Currently active employees. at_risk=true means low satisfaction score.',
    },
  });
});

// GET /demo/hr/departments
demoHrRouter.get('/departments', (_req: Request, res: Response) => {
  res.json({
    total: DEPARTMENTS.length,
    data: DEPARTMENTS,
    meta: {
      description: 'Departments with headcount and annualised turnover rate percentage',
    },
  });
});

// GET /demo/hr/summary
demoHrRouter.get('/summary', (_req: Request, res: Response) => {
  const voluntary = TERMINATED_EMPLOYEES.filter(e => e.voluntary).length;
  const involuntary = TERMINATED_EMPLOYEES.length - voluntary;

  // Count reasons
  const reasonCounts: Record<string, number> = {};
  for (const e of TERMINATED_EMPLOYEES) {
    reasonCounts[e.termination_reason] = (reasonCounts[e.termination_reason] ?? 0) + 1;
  }
  const top_reasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }));

  // Count by department
  const deptCounts: Record<string, number> = {};
  for (const e of TERMINATED_EMPLOYEES) {
    deptCounts[e.department] = (deptCounts[e.department] ?? 0) + 1;
  }
  const by_department = Object.entries(deptCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([department, departures]) => ({ department, departures }));

  const avg_tenure = Math.round(
    TERMINATED_EMPLOYEES.reduce((s, e) => s + e.tenure_months, 0) / TERMINATED_EMPLOYEES.length
  );

  const scored = TERMINATED_EMPLOYEES.filter(e => e.exit_interview_score !== null);
  const avg_exit_score = scored.length
    ? +(scored.reduce((s, e) => s + (e.exit_interview_score ?? 0), 0) / scored.length).toFixed(1)
    : null;

  const at_risk_count = ACTIVE_EMPLOYEES.filter(e => e.at_risk).length;

  res.json({
    period: 'Last 6 months',
    total_terminations: TERMINATED_EMPLOYEES.length,
    voluntary_terminations: voluntary,
    involuntary_terminations: involuntary,
    voluntary_rate_pct: Math.round((voluntary / TERMINATED_EMPLOYEES.length) * 100),
    average_tenure_months: avg_tenure,
    average_exit_interview_score: avg_exit_score,
    active_employees_at_risk: at_risk_count,
    top_leaving_reasons: top_reasons,
    terminations_by_department: by_department,
  });
});
