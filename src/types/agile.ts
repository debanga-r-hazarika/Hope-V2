export interface AgileStatus {
  id: string;
  name: string;
  description?: string | null;
  position: number;
  color?: string | null;
}

export interface AgileRoadmapBucket {
  id: string;
  name: string;
  sortOrder: number;
}

export interface AgileIssue {
  id: string;
  title: string;
  description?: string | null;
  statusId: string | null;
  priority: 'high' | 'normal' | 'low';
  deadlineDate?: string | null;
  estimate?: number | null;
  ownerId?: string | null;
  ownerName?: string | null;
  tags: string[];
  roadmapBucket?: string | null;
  ordering: number;
  createdAt: string;
  updatedAt: string;
  readyForReview?: boolean;
  reviewRejected?: boolean;
}

export interface AgileIssueInput {
  title: string;
  description?: string;
  statusId?: string;
  priority?: 'high' | 'normal' | 'low';
  deadlineDate?: string | null;
  estimate?: number | null;
  ownerId?: string | null;
  ownerName?: string | null;
  tags?: string[];
  roadmapBucket?: string | null;
  ordering?: number;
  createdBy?: string;
  readyForReview?: boolean;
  reviewRejected?: boolean;
}

export interface AgileFilters {
  statusIds?: string[];
  ownerIds?: string[];
  tag?: string;
  readyOnly?: boolean;
}


