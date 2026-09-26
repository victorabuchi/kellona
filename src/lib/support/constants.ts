export const REPORT_CATEGORIES = ['broken', 'dirty', 'access', 'other'] as const;
export const REPORT_STATUSES = ['new', 'in_progress', 'done'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
