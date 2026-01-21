-- Migration: Add Retirement Accounts Tables
-- Run this after the initial schema to add retirement account support

-- Retirement accounts table
CREATE TABLE IF NOT EXISTS retirement_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL CHECK (account_type IN ('ROTH_IRA', '401K', 'TRADITIONAL_IRA', '403B', '457B', 'SEP_IRA', 'SIMPLE_IRA', 'PENSION', 'HSA', 'OTHER')),
    current_value DECIMAL(20, 2) NOT NULL DEFAULT 0,
    estimated_cagr DECIMAL(5, 2) NOT NULL DEFAULT 7,
    employer_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Retirement account contributions table
CREATE TABLE IF NOT EXISTS retirement_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES retirement_accounts(id) ON DELETE CASCADE,
    contribution_type VARCHAR(20) NOT NULL CHECK (contribution_type IN ('PERSONAL', 'EMPLOYER_MATCH', 'EMPLOYER_CONTRIBUTION')),
    amount DECIMAL(20, 2) NOT NULL,
    frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('WEEKLY', 'BI_WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'ONE_TIME')),
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Retirement account value history (for tracking changes)
CREATE TABLE IF NOT EXISTS retirement_value_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES retirement_accounts(id) ON DELETE CASCADE,
    value DECIMAL(20, 2) NOT NULL,
    recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_retirement_accounts_user_id ON retirement_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_retirement_contributions_account_id ON retirement_contributions(account_id);
CREATE INDEX IF NOT EXISTS idx_retirement_value_history_account_id ON retirement_value_history(account_id);

-- Add triggers for updated_at (only if they don't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_retirement_accounts_updated_at') THEN
        CREATE TRIGGER update_retirement_accounts_updated_at 
        BEFORE UPDATE ON retirement_accounts
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_retirement_contributions_updated_at') THEN
        CREATE TRIGGER update_retirement_contributions_updated_at 
        BEFORE UPDATE ON retirement_contributions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
