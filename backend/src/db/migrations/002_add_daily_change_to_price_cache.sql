-- Add daily change columns to price_cache table
ALTER TABLE price_cache 
ADD COLUMN IF NOT EXISTS daily_change DECIMAL(20, 8) DEFAULT 0,
ADD COLUMN IF NOT EXISTS daily_change_percent DECIMAL(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS previous_close DECIMAL(20, 8) DEFAULT 0;

-- Update existing records to have 0 for change values
UPDATE price_cache SET 
  daily_change = 0, 
  daily_change_percent = 0,
  previous_close = 0 
WHERE daily_change IS NULL OR previous_close IS NULL;
