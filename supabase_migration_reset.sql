-- Reset and recreate the entire database schema
-- This will drop and recreate all objects

-- Drop existing objects in correct order (reverse of creation order)
-- Note: Some objects may not exist, which is fine
DO $$
BEGIN
    -- Try to drop publication if it exists
    BEGIN
        DROP PUBLICATION IF EXISTS supabase_realtime CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Publication supabase_realtime does not exist or cannot be dropped';
    END;
    
    -- Try to drop triggers if they exist
    BEGIN
        DROP TRIGGER IF EXISTS on_kundorder_status ON public.red_points;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Trigger on_kundorder_status does not exist';
    END;
    
    BEGIN
        DROP TRIGGER IF EXISTS log_red_point_status_changes ON public.red_points;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Trigger log_red_point_status_changes does not exist';
    END;
    
    BEGIN
        DROP TRIGGER IF EXISTS update_red_points_last_updated ON public.red_points;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Trigger update_red_points_last_updated does not exist';
    END;
    
    -- Try to drop functions if they exist
    BEGIN
        DROP FUNCTION IF EXISTS log_status_change() CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Function log_status_change does not exist';
    END;
    
    BEGIN
        DROP FUNCTION IF EXISTS notify_kundorder() CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Function notify_kundorder does not exist';
    END;
    
    BEGIN
        DROP FUNCTION IF EXISTS update_last_updated_column() CASCADE;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Function update_last_updated_column does not exist';
    END;
END $$;

-- Drop tables in correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.status_history CASCADE;
DROP TABLE IF EXISTS public.red_points CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.departments CASCADE;

-- Drop types
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS action_type CASCADE;
DROP TYPE IF EXISTS point_status CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;

-- Now recreate everything fresh
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('ADMIN', 'TEAM_LEADER', 'LINEFEEDER', 'MONITOR', 'DEPARTMENT');
CREATE TYPE point_status AS ENUM ('LEDIG', 'UPPTAGEN', 'SKRAP', 'KUNDORDER');
CREATE TYPE action_type AS ENUM ('PICKUP', 'COMPLETE', 'SCAN', 'STATUS_CHANGE');
CREATE TYPE notification_type AS ENUM ('KUNDORDER', 'SKRAP', 'URGENT');

-- Departments table
CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  location TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Red Points table
CREATE TABLE public.red_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  point_number INTEGER NOT NULL UNIQUE CHECK (point_number BETWEEN 1 AND 60),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE RESTRICT,
  status point_status DEFAULT 'LEDIG',
  qr_code TEXT NOT NULL UNIQUE,
  location_x DECIMAL(10, 2),
  location_y DECIMAL(10, 2),
  current_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Status History table
CREATE TABLE public.status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  point_id UUID NOT NULL REFERENCES public.red_points(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  old_status point_status NOT NULL,
  new_status point_status NOT NULL,
  action_type action_type NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  point_id UUID NOT NULL REFERENCES public.red_points(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5)
);

-- Indexes for performance
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_department ON public.users(department_id);
CREATE INDEX idx_red_points_status ON public.red_points(status);
CREATE INDEX idx_red_points_department ON public.red_points(department_id);
CREATE INDEX idx_red_points_point_number ON public.red_points(point_number);
CREATE INDEX idx_status_history_point ON public.status_history(point_id);
CREATE INDEX idx_status_history_timestamp ON public.status_history(timestamp DESC);
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(is_read);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.red_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view their own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins and Team Leaders can view all users"
  ON public.users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

CREATE POLICY "Admins and Team Leaders can insert users"
  ON public.users FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

CREATE POLICY "Admins and Team Leaders can update users"
  ON public.users FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

-- RLS Policies for departments
CREATE POLICY "Everyone can view active departments"
  ON public.departments FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins and Team Leaders can manage departments"
  ON public.departments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

-- RLS Policies for red_points
CREATE POLICY "Everyone can view active red points"
  ON public.red_points FOR SELECT
  USING (is_active = true);

CREATE POLICY "Linefeeders can update red point status"
  ON public.red_points FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('LINEFEEDER', 'ADMIN')
    )
  );

CREATE POLICY "Department users can update their points"
  ON public.red_points FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role = 'DEPARTMENT'
      AND department_id = red_points.department_id
    )
  );

CREATE POLICY "Admins and Team Leaders can manage red points"
  ON public.red_points FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() 
      AND role IN ('ADMIN', 'TEAM_LEADER')
    )
  );

-- RLS Policies for status_history
CREATE POLICY "Everyone can view status history"
  ON public.status_history FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert history"
  ON public.status_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for notifications
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Function to automatically update last_updated timestamp
CREATE OR REPLACE FUNCTION update_last_updated_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for red_points
CREATE TRIGGER update_red_points_last_updated
  BEFORE UPDATE ON public.red_points
  FOR EACH ROW
  EXECUTE FUNCTION update_last_updated_column();

-- Function to create notifications when status changes to KUNDORDER
CREATE OR REPLACE FUNCTION notify_kundorder()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'KUNDORDER' AND OLD.status != 'KUNDORDER' THEN
    INSERT INTO public.notifications (user_id, point_id, type, message, priority)
    SELECT 
      u.id,
      NEW.id,
      'KUNDORDER',
      'Kundorder redo vid punkt ' || NEW.point_number::TEXT,
      5
    FROM public.users u
    WHERE u.role = 'LINEFEEDER' AND u.is_active = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic notifications
CREATE TRIGGER on_kundorder_status
  AFTER UPDATE OF status ON public.red_points
  FOR EACH ROW
  EXECUTE FUNCTION notify_kundorder();

-- Function to create status history automatically
CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    INSERT INTO public.status_history (
      point_id, 
      user_id, 
      old_status, 
      new_status, 
      action_type
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.current_user_id, auth.uid()),
      OLD.status,
      NEW.status,
      'STATUS_CHANGE'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic status history
CREATE TRIGGER log_red_point_status_changes
  AFTER UPDATE OF status ON public.red_points
  FOR EACH ROW
  EXECUTE FUNCTION log_status_change();

-- Enable Realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.red_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.status_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

-- Insert test departments
INSERT INTO public.departments (name, location) VALUES
  ('Lager A', 'Byggnad 1'),
  ('Lager B', 'Byggnad 2'),
  ('Lager C', 'Byggnad 3');

-- Generate 60 red points
DO $$
DECLARE
  dept_ids UUID[];
  dept_id UUID;
BEGIN
  SELECT ARRAY_AGG(id) INTO dept_ids FROM public.departments;
  
  FOR i IN 1..60 LOOP
    dept_id := dept_ids[((i - 1) % array_length(dept_ids, 1)) + 1];
    
    INSERT INTO public.red_points (
      point_number,
      department_id,
      qr_code,
      status,
      location_x,
      location_y
    ) VALUES (
      i,
      dept_id,
      'RP-' || LPAD(i::TEXT, 3, '0') || '-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT,
      'LEDIG',
      (RANDOM() * 100)::DECIMAL(10,2),
      (RANDOM() * 100)::DECIMAL(10,2)
    );
  END LOOP;
END $$;
