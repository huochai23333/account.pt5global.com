export type SalesLeadBoard = "hall" | "mine" | "used" | "all_claimed";
export type SalesLeadStatus = "hall" | "claimed" | "used";

export type SalesLead = {
  id: string;
  primary_source_lead_id: string;
  latest_source_date: string;
  name: string;
  category: string;
  country: string;
  region_timezone: string | null;
  priority: "A" | "B" | "C";
  contact_today: boolean;
  target_customer: string | null;
  customer_profile: string | null;
  public_pricing: string | null;
  recommended_approach: string | null;
  contact_talking_points: string | null;
  public_contact: string | null;
  website_url: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  community_url: string | null;
  source_url: string;
  source_notes: string | null;
  status: SalesLeadStatus;
  current_assignee_user_id: string | null;
  current_assignment_id: string | null;
  claimed_at: string | null;
  first_contact_at: string | null;
  last_contact_at: string | null;
  next_follow_up_at: string | null;
  expires_at: string | null;
  hard_deadline_at: string | null;
  used_at: string | null;
  used_summary: string | null;
  assignee_name?: string | null;
  contact_count?: number;
};

export type SalesLeadContact = {
  id: string;
  author_name: string;
  contacted_at: string;
  contact_channel: string;
  contact_outcome: string;
  note: string;
  next_follow_up_at: string | null;
};

export type SalesLeadAssignment = {
  id: string;
  assignee_name: string;
  claimed_at: string;
  first_contact_at: string | null;
  last_contact_at: string | null;
  ended_at: string | null;
  ended_reason: string | null;
  end_note: string | null;
  reopened_at: string | null;
  reopen_note: string | null;
};

export type SalesLeadDetail = {
  lead: SalesLead;
  assignments: SalesLeadAssignment[];
  contacts: SalesLeadContact[];
};

export type SalesLeadPerson = { user_id: string; name: string };

export type SalesLeadPageData = {
  board: SalesLeadBoard;
  boardCounts: { hall: number; mine: number; used: number; allClaimed: number };
  items: SalesLead[];
  limit: number;
  offset: number;
  totalCount: number;
  salespeople: SalesLeadPerson[];
  syncState: {
    last_attempt_at?: string | null;
    last_successful_at?: string | null;
    last_error?: string | null;
  } | null;
  recentImportRuns: Array<{
    id: string;
    source_file_path: string;
    status: "running" | "success" | "failed";
    imported_count: number;
    updated_count: number;
    conflict_count: number;
    started_at: string;
  }>;
  canManage: boolean;
  hasPermission: boolean;
};

export type SalesLeadContactInput = {
  leadId: string;
  channel: string;
  outcome: string;
  note: string;
  nextFollowUpAt: string | null;
};
