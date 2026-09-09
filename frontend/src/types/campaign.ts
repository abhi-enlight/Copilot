/**
 * Shared campaign domain types.
 *
 * Lives outside the API route so CLIENT components can import these types
 * without dragging server-only modules (next/headers, the entitlements
 * engine) into the browser bundle.
 */

export interface AspectTask {
  id: string;
  sopCode: string;
  title: string;
  aspect: "legal" | "compliance" | "accounting" | "implementation";
  assignee: string;
  role: string;
  urgency: "HIGHEST" | "HIGH" | "MEDIUM" | "NORMAL";
  tat: string;
  status: "COMPLETED" | "IN_PROGRESS" | "PENDING_APPROVAL" | "PENDING_INPUT" | "PENDING_SIGN_OFF";
  // Zoho CRM Task sub-record (task within a CRM Deal)
  zohoCrmTaskId?: string;
  zohoCrmTaskStatus?: "Open" | "In Progress" | "Under Review" | "Closed";
  details: string;
  verificationRequirement: string;
  dependencies?: string[];
  mandatoryGate: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  client: string;
  category: "FMCG" | "Beverages" | "Retail" | "Electronics" | "BFSI" | "QSR";
  rewardType: "Cashback" | "EGV" | "Scratch & Win" | "Merchandise";
  budget: string;
  budgetNumeric: number;
  codeVolume: string;
  codeVolumeNumeric: number;
  startDate: string;
  endDate: string;
  status: "Draft" | "Planning" | "In Review" | "Approved" | "Live";
  completionRate: number;

  // Zoho CRM, Deal record tracking the campaign as a sales/client opportunity
  zohoCrmDealId?: string;
  zohoCrmDealUrl?: string;
  zohoCrmDealStage?: string;

  // Zoho Projects, Project with milestones for task execution tracking
  zohoProjectId?: string;
  zohoProjectUrl?: string;

  // Zoho Books, Invoice/Estimate for advance payment, escrow, GST billing
  zohoBooksInvoiceId?: string;
  zohoBooksInvoiceUrl?: string;

  // Aggregate sync health across all connected Zoho products
  zohoSyncStatus?: "Pending" | "Partial" | "Synced" | "Failed";
  lastZohoSync?: string;
  booksCustomerId?: string;

  brief: string;
  aspectSummary: {
    legal: { total: number; done: number; status: "Approved" | "In Review" | "Pending" };
    compliance: { total: number; done: number; status: "Approved" | "In Review" | "Pending" };
    accounting: { total: number; done: number; status: "Approved" | "In Review" | "Pending" };
    implementation: { total: number; done: number; status: "Approved" | "In Review" | "Pending" };
  };
  tasks: AspectTask[];
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
}
