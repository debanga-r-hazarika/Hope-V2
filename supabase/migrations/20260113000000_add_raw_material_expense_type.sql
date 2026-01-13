-- Add 'raw_material' to expense_type constraint and add other_expense_type_specification column

-- Drop existing constraint
ALTER TABLE public.expenses
  DROP CONSTRAINT IF EXISTS expenses_expense_type_check;

-- Add new constraint with 'raw_material' included
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_expense_type_check 
  CHECK (expense_type IN ('operational', 'salary', 'utilities', 'maintenance', 'raw_material', 'other'));

-- Add column to store specification when expense_type is 'other'
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS other_expense_type_specification text;
