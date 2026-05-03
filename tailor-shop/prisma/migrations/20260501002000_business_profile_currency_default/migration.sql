-- Change the default currency from GHS (Ghanaian Cedi) to USD for regional neutrality.
-- Existing rows are unaffected; only newly created BusinessProfile rows default to USD.
ALTER TABLE "BusinessProfile" ALTER COLUMN "currency" SET DEFAULT 'USD';
