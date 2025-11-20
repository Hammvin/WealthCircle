-- =============================================
-- WealthCircle Chama Management System
-- Secure Database Schema v1.0
-- =============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- ENUM Types for Data Integrity
-- =============================================

CREATE TYPE user_role AS ENUM ('member', 'treasurer', 'chairperson', 'secretary');
CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'paid', 'defaulted');
CREATE TYPE transaction_type AS ENUM ('contribution', 'payout', 'loan', 'fine', 'dividend');
CREATE TYPE transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE vote_type AS ENUM ('approve', 'reject');
CREATE TYPE contribution_cycle AS ENUM ('daily', 'weekly', 'monthly', 'quarterly');
CREATE TYPE notification_type AS ENUM ('info', 'warning', 'success', 'error', 'vote_required');

-- =============================================
-- Core Tables
-- =============================================

-- Users table (extends Supabase auth.users)
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number VARCHAR(15) NOT NULL UNIQUE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    risk_score INTEGER DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    profile_picture_url TEXT,
    id_number VARCHAR(20),
    date_of_birth DATE,
    occupation VARCHAR(100),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT valid_phone_number CHECK (phone_number ~ '^254[17]\d{8}$'),
    CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT valid_full_name CHECK (length(full_name) >= 2 AND length(full_name) <= 100)
);

-- Chamas table
CREATE TABLE chamas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    invite_code VARCHAR(10) UNIQUE NOT NULL,
    total_kitty DECIMAL(12,2) DEFAULT 0 CHECK (total_kitty >= 0),
    contribution_amount DECIMAL(10,2) NOT NULL CHECK (contribution_amount > 0),
    contribution_cycle contribution_cycle NOT NULL DEFAULT 'monthly',
    savings_goal DECIMAL(12,2) CHECK (savings_goal >= 0),
    max_loan_multiplier INTEGER DEFAULT 3 CHECK (max_loan_multiplier >= 1 AND max_loan_multiplier <= 10),
    min_approval_percentage INTEGER DEFAULT 51 CHECK (min_approval_percentage >= 51 AND min_approval_percentage <= 100),
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT valid_chama_name CHECK (length(name) >= 2 AND length(name) <= 100),
    CONSTRAINT valid_contribution_amount CHECK (contribution_amount <= 1000000)
);

-- Chama Members junction table
CREATE TABLE chama_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'member',
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Security: One role per user per chama
    UNIQUE(chama_id, user_id),
    
    -- Security constraints
    CONSTRAINT valid_member_role CHECK (role IN ('member', 'treasurer', 'chairperson', 'secretary'))
);

-- =============================================
-- Financial Tables
-- =============================================

-- Payout Requests table
CREATE TABLE payout_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('payout', 'loan')),
    purpose TEXT NOT NULL,
    interest_rate DECIMAL(5,2) CHECK (interest_rate >= 0 AND interest_rate <= 100),
    repayment_period INTEGER CHECK (repayment_period >= 1 AND repayment_period <= 36),
    status request_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES chama_members(id),
    
    -- Security constraints
    CONSTRAINT valid_purpose_length CHECK (length(purpose) >= 5 AND length(purpose) <= 500),
    CONSTRAINT loan_requires_terms CHECK (
        (request_type = 'loan' AND interest_rate IS NOT NULL AND repayment_period IS NOT NULL) OR
        request_type = 'payout'
    )
);

-- Payout Votes table
CREATE TABLE payout_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_request_id UUID NOT NULL REFERENCES payout_requests(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    vote vote_type NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    comments TEXT,
    
    -- Security: One vote per member per request
    UNIQUE(payout_request_id, member_id),
    
    -- Security constraints
    CONSTRAINT valid_vote CHECK (vote IN ('approve', 'reject')),
    CONSTRAINT valid_comments_length CHECK (length(comments) <= 500)
);

-- Transactions table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    transaction_type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    transaction_code VARCHAR(50) UNIQUE,
    phone_number VARCHAR(15) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    
    -- Security constraints
    CONSTRAINT valid_phone_number_format CHECK (phone_number ~ '^254[17]\d{8}$'),
    CONSTRAINT valid_description_length CHECK (length(description) <= 500)
);

-- Contributions table
CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    contribution_date DATE NOT NULL DEFAULT CURRENT_DATE,
    cycle_period VARCHAR(20) NOT NULL,
    is_paid BOOLEAN DEFAULT FALSE,
    paid_at TIMESTAMP WITH TIME ZONE,
    transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT unique_contribution_per_member_per_cycle UNIQUE(chama_id, member_id, cycle_period)
);

-- Loan Repayments table
CREATE TABLE loan_repayments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payout_request_id UUID NOT NULL REFERENCES payout_requests(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    paid_date DATE,
    is_paid BOOLEAN DEFAULT FALSE,
    penalty_amount DECIMAL(10,2) DEFAULT 0 CHECK (penalty_amount >= 0),
    transaction_id UUID REFERENCES transactions(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT valid_due_date CHECK (due_date >= CURRENT_DATE)
);

-- =============================================
-- Audit & Security Tables
-- =============================================

-- Audit Log table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(50) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Security Events table
CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL,
    severity VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Failed Login Attempts table
CREATE TABLE failed_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(15) NOT NULL,
    ip_address INET NOT NULL,
    user_agent TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_blocked BOOLEAN DEFAULT FALSE
);

-- =============================================
-- Notification & Communication Tables
-- =============================================

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type notification_type NOT NULL DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    action_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT valid_title_length CHECK (length(title) >= 1 AND length(title) <= 200),
    CONSTRAINT valid_message_length CHECK (length(message) <= 1000)
);

-- Meeting table
CREATE TABLE meetings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chama_id UUID NOT NULL REFERENCES chamas(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
    duration_minutes INTEGER DEFAULT 60 CHECK (duration_minutes > 0 AND duration_minutes <= 480),
    location TEXT,
    is_virtual BOOLEAN DEFAULT FALSE,
    meeting_link TEXT,
    created_by UUID NOT NULL REFERENCES chama_members(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Security constraints
    CONSTRAINT valid_meeting_title CHECK (length(title) >= 5 AND length(title) <= 200),
    CONSTRAINT future_meeting_date CHECK (meeting_date > NOW())
);

-- Meeting Attendees table
CREATE TABLE meeting_attendees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES chama_members(id) ON DELETE CASCADE,
    will_attend BOOLEAN,
    attended BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE,
    left_at TIMESTAMP WITH TIME ZONE,
    
    -- Security: One attendance record per member per meeting
    UNIQUE(meeting_id, member_id)
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- Users indexes
CREATE INDEX idx_users_phone_number ON users(phone_number);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Chamas indexes
CREATE INDEX idx_chamas_invite_code ON chamas(invite_code);
CREATE INDEX idx_chamas_created_by ON chamas(created_by);
CREATE INDEX idx_chamas_is_active ON chamas(is_active);

-- Chama Members indexes
CREATE INDEX idx_chama_members_user_id ON chama_members(user_id);
CREATE INDEX idx_chama_members_chama_id ON chama_members(chama_id);
CREATE INDEX idx_chama_members_role ON chama_members(role);
CREATE INDEX idx_chama_members_is_active ON chama_members(is_active);

-- Payout Requests indexes
CREATE INDEX idx_payout_requests_chama_id ON payout_requests(chama_id);
CREATE INDEX idx_payout_requests_member_id ON payout_requests(member_id);
CREATE INDEX idx_payout_requests_status ON payout_requests(status);
CREATE INDEX idx_payout_requests_created_at ON payout_requests(created_at);

-- Payout Votes indexes
CREATE INDEX idx_payout_votes_request_id ON payout_votes(payout_request_id);
CREATE INDEX idx_payout_votes_member_id ON payout_votes(member_id);

-- Transactions indexes
CREATE INDEX idx_transactions_chama_id ON transactions(chama_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_code ON transactions(transaction_code);

-- Contributions indexes
CREATE INDEX idx_contributions_chama_id ON contributions(chama_id);
CREATE INDEX idx_contributions_member_id ON contributions(member_id);
CREATE INDEX idx_contributions_cycle_period ON contributions(cycle_period);
CREATE INDEX idx_contributions_is_paid ON contributions(is_paid);

-- Audit Log indexes
CREATE INDEX idx_audit_logs_table_record ON audit_logs(table_name, record_id);
CREATE INDEX idx_audit_logs_changed_at ON audit_logs(changed_at);
CREATE INDEX idx_audit_logs_changed_by ON audit_logs(changed_by);

-- Security Events indexes
CREATE INDEX idx_security_events_user_id ON security_events(user_id);
CREATE INDEX idx_security_events_type ON security_events(event_type);
CREATE INDEX idx_security_events_created_at ON security_events(created_at);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamas ENABLE ROW LEVEL SECURITY;
ALTER TABLE chama_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_repayments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;

-- Audit and security tables are admin-only (no RLS policies for regular users)

-- Users policies
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Chamas policies
CREATE POLICY "Members can view their chamas" ON chamas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chama_members 
            WHERE chama_members.chama_id = chamas.id 
            AND chama_members.user_id = auth.uid()
            AND chama_members.is_active = true
        )
    );

CREATE POLICY "Chairpersons can update their chamas" ON chamas
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM chama_members 
            WHERE chama_members.chama_id = chamas.id 
            AND chama_members.user_id = auth.uid()
            AND chama_members.role = 'chairperson'
            AND chama_members.is_active = true
        )
    );

-- Chama Members policies
CREATE POLICY "Members can view chama members" ON chama_members
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chama_members AS cm
            WHERE cm.chama_id = chama_members.chama_id
            AND cm.user_id = auth.uid()
            AND cm.is_active = true
        )
    );

-- Payout Requests policies
CREATE POLICY "Members can view payout requests in their chamas" ON payout_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM chama_members 
            WHERE chama_members.chama_id = payout_requests.chama_id 
            AND chama_members.user_id = auth.uid()
            AND chama_members.is_active = true
        )
    );

CREATE POLICY "Members can create payout requests in their chamas" ON payout_requests
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM chama_members 
            WHERE chama_members.chama_id = payout_requests.chama_id 
            AND chama_members.user_id = auth.uid()
            AND chama_members.is_active = true
        )
    );

-- =============================================
-- Secure Functions
-- =============================================

-- Function to get chama statistics securely
CREATE OR REPLACE FUNCTION get_chama_stats(chama_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Security: Verify user is member of this chama
    IF NOT EXISTS (
        SELECT 1 FROM chama_members 
        WHERE chama_members.chama_id = $1 
        AND chama_members.user_id = auth.uid()
        AND chama_members.is_active = true
    ) THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    SELECT jsonb_build_object(
        'total_members', COUNT(DISTINCT cm.id),
        'total_kitty', COALESCE(c.total_kitty, 0),
        'active_loans', COUNT(pr.id) FILTER (WHERE pr.request_type = 'loan' AND pr.status IN ('approved', 'pending')),
        'pending_requests', COUNT(pr.id) FILTER (WHERE pr.status = 'pending'),
        'total_contributions', COALESCE(SUM(cont.amount) FILTER (WHERE cont.is_paid = true), 0),
        'meetings_this_month', COUNT(m.id) FILTER (WHERE m.meeting_date >= date_trunc('month', CURRENT_DATE))
    ) INTO result
    FROM chamas c
    LEFT JOIN chama_members cm ON c.id = cm.chama_id AND cm.is_active = true
    LEFT JOIN payout_requests pr ON c.id = pr.chama_id
    LEFT JOIN contributions cont ON c.id = cont.chama_id
    LEFT JOIN meetings m ON c.id = m.chama_id AND m.meeting_date >= date_trunc('month', CURRENT_DATE)
    WHERE c.id = $1
    GROUP BY c.id, c.total_kitty;

    RETURN result;
END;
$$;

-- Function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to generate secure invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TRIGGER AS $$
DECLARE
    new_code VARCHAR(10);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate 8-character alphanumeric code
        new_code := upper(substring(md5(random()::text) from 1 for 8));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM chamas WHERE invite_code = new_code) INTO code_exists;
        
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    NEW.invite_code := new_code;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
    p_user_id UUID,
    p_event_type VARCHAR(50),
    p_severity VARCHAR(10),
    p_description TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO security_events (
        user_id, event_type, severity, description, 
        ip_address, user_agent, metadata
    ) VALUES (
        p_user_id, p_event_type, p_severity, p_description,
        p_ip_address, p_user_agent, p_metadata
    );
END;
$$;

-- =============================================
-- Triggers
-- =============================================

-- Update timestamps triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chamas_updated_at BEFORE UPDATE ON chamas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at BEFORE UPDATE ON payout_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate invite code trigger
CREATE TRIGGER generate_chama_invite_code BEFORE INSERT ON chamas
    FOR EACH ROW EXECUTE FUNCTION generate_invite_code();

-- Audit log triggers (example for users table)
CREATE OR REPLACE FUNCTION log_user_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (table_name, record_id, action, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), auth.uid());
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (table_name, record_id, action, old_data, changed_by)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), auth.uid());
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER log_user_audit
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION log_user_changes();

-- =============================================
-- Secure Views
-- =============================================

-- View for member dashboard
CREATE VIEW member_dashboard AS
SELECT 
    u.id as user_id,
    u.full_name,
    u.phone_number,
    COUNT(DISTINCT cm.chama_id) as total_chamas,
    COUNT(DISTINCT pr.id) FILTER (WHERE pr.status = 'pending') as pending_requests,
    COUNT(DISTINCT n.id) FILTER (WHERE n.is_read = false) as unread_notifications,
    COALESCE(SUM(t.amount) FILTER (WHERE t.status = 'completed' AND t.transaction_type = 'contribution'), 0) as total_contributions
FROM users u
LEFT JOIN chama_members cm ON u.id = cm.user_id AND cm.is_active = true
LEFT JOIN payout_requests pr ON cm.id = pr.member_id
LEFT JOIN notifications n ON u.id = n.user_id
LEFT JOIN transactions t ON u.id = t.user_id
WHERE u.id = auth.uid()
GROUP BY u.id, u.full_name, u.phone_number;

-- =============================================
-- Initial Data (Optional - for testing)
-- =============================================

-- Insert sample data (remove in production)
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    email_change_token_current,
    email_change_confirm_status
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-1111-1111-111111111111',
    'authenticated',
    'authenticated',
    'user.254712345678@wealthcircle.ke',
    crypt('SecurePassword123!', gen_salt('bf')),
    NOW(),
    NULL,
    '',
    NULL,
    '',
    NULL,
    '',
    '',
    NULL,
    NULL,
    '{"provider":"email","providers":["email"]}',
    '{}',
    NULL,
    NOW(),
    NOW(),
    '',
    NULL,
    '',
    '',
    NULL,
    '',
    0
);

INSERT INTO users (id, phone_number, full_name, email, is_verified, is_active)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '254712345678',
    'Test User',
    'user.254712345678@wealthcircle.ke',
    true,
    true
);

-- =============================================
-- Comments for Documentation
-- =============================================

COMMENT ON TABLE users IS 'Stores user profiles and extends Supabase auth';
COMMENT ON TABLE chamas IS 'Stores chama groups and their configurations';
COMMENT ON TABLE chama_members IS 'Junction table for chama membership and roles';
COMMENT ON TABLE payout_requests IS 'Stores loan and payout requests with voting system';
COMMENT ON TABLE payout_votes IS 'Stores member votes on payout requests';
COMMENT ON TABLE transactions IS 'Audit trail for all financial transactions';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for all data changes';
COMMENT ON TABLE security_events IS 'Security monitoring and incident logging';

COMMENT ON COLUMN users.risk_score IS 'Risk assessment score (0-100) for creditworthiness';
COMMENT ON COLUMN chamas.max_loan_multiplier IS 'Maximum loan amount multiplier based on contributions';
COMMENT ON COLUMN chamas.min_approval_percentage IS 'Minimum percentage of votes required for approval';

-- =============================================
-- Database Security Configuration
-- =============================================

-- Set secure search path
ALTER DATABASE postgres SET search_path TO "$user", public;

-- Enable SSL
ALTER SYSTEM SET ssl = on;

-- Set connection limits
ALTER SYSTEM SET max_connections = '100';

-- Set statement timeout
ALTER SYSTEM SET statement_timeout = '30s';

-- Log all connections
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;

-- Notify that the secure database schema has been created
DO $$ 
BEGIN
    RAISE NOTICE 'WealthCircle Secure Database Schema created successfully';
    RAISE NOTICE 'Remember to:';
    RAISE NOTICE '1. Run VACUUM ANALYZE after data population';
    RAISE NOTICE '2. Set up regular backups';
    RAISE NOTICE '3. Monitor security events table';
    RAISE NOTICE '4. Regularly update row level security policies';
END $$;