export type CustomerTypeStatus = 'active' | 'inactive';

export interface CustomerType {
  id: string;
  type_key: string;
  display_name: string;
  description?: string | null;
  status: CustomerTypeStatus;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
}

export interface CreateCustomerTypeInput {
  type_key: string;
  display_name: string;
  description?: string;
  status?: CustomerTypeStatus;
}

export interface UpdateCustomerTypeInput {
  display_name?: string;
  description?: string;
  status?: CustomerTypeStatus;
}
