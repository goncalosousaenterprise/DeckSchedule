-- Supabase SQL Schema for Desk Booking App

-- 1. Create Desks Table
CREATE TABLE desks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Bookings Table
CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  desk_id UUID REFERENCES desks(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  user_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, date), -- A user can only book 1 desk per day
  UNIQUE(desk_id, date)  -- A desk can only be booked by 1 user per day
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE desks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies for Desks
-- Anyone authenticated can read desks
CREATE POLICY "Desks are viewable by authenticated users" 
ON desks FOR SELECT 
TO authenticated 
USING (true);

-- 5. Create Policies for Bookings
-- Anyone authenticated can read all bookings (to see who is in the office)
CREATE POLICY "Bookings are viewable by authenticated users" 
ON bookings FOR SELECT 
TO authenticated 
USING (true);

-- Users can insert their own bookings
CREATE POLICY "Users can insert their own bookings" 
ON bookings FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookings
CREATE POLICY "Users can delete their own bookings" 
ON bookings FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- Users can update their own bookings
CREATE POLICY "Users can update their own bookings" 
ON bookings FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Insert some initial desks
INSERT INTO desks (name) VALUES 
  ('Desk 1'), ('Desk 2'), ('Desk 3'), ('Desk 4'), ('Desk 5'),
  ('Desk 6'), ('Desk 7'), ('Desk 8'), ('Desk 9'), ('Desk 10');
