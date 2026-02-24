-- Track which orders have already had a digest email sent for a given date.
-- Prevents duplicate emails when the digest is run multiple times for the same date (e.g. manual test runs).
-- Each (order_id, digest_date) is sent at most once.

CREATE TABLE IF NOT EXISTS order_digest_sent (
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  digest_date date NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, digest_date)
);

COMMENT ON TABLE order_digest_sent IS 'Tracks orders that already received a daily digest email for a given date (IST). Prevents re-sending when digest runs multiple times for the same date.';

-- Allow service role / Edge Function to insert and select (RLS can restrict others if needed)
ALTER TABLE order_digest_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage order_digest_sent"
  ON order_digest_sent
  FOR ALL
  USING (true)
  WITH CHECK (true);
