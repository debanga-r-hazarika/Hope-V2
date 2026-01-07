/*
  # Add requires_password_change field to users table

  1. Changes
    - Add `requires_password_change` boolean column to `users` table
    - Default value is false for existing users
    - New users created by admins will have this set to true

  2. Purpose
    - Track users who need to change their password on first login
    - Enforce security policy for temporary passwords
*/

-- Add requires_password_change column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS requires_password_change boolean DEFAULT false;

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_users_requires_password_change 
ON users(requires_password_change) 
WHERE requires_password_change = true;