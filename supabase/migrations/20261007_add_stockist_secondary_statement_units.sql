alter table public.sales_entry_details
  add column if not exists opening_units integer not null default 0,
  add column if not exists receipts_units integer not null default 0,
  add column if not exists closing_units integer not null default 0,
  add column if not exists sale_units integer not null default 0,
  add column if not exists receipts_reimbursement_units integer not null default 0,
  add column if not exists free_issue_units integer not null default 0,
  add column if not exists purchase_return_units integer not null default 0,
  add column if not exists actual_secondary_units integer not null default 0;
