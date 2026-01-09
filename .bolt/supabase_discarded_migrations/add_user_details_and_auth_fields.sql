-- 1. Add new columns as nullable first
ALTER TABLE public.users
ADD COLUMN title TEXT,
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT,
ADD COLUMN employee_id TEXT,
ADD COLUMN phone_number TEXT;

-- 2. Make email nullable (if not already)
ALTER TABLE public.users
ALTER COLUMN email DROP NOT NULL;

-- 3. Update existing rows with default/placeholder values for new NOT NULL columns
--    Generate unique phone numbers for existing users that have NULL phone_number
UPDATE public.users
SET
    title = COALESCE(title, 'Mr'), -- Set a default title for existing users
    first_name = COALESCE(first_name, username), -- Use username as a placeholder
    last_name = COALESCE(last_name, 'User'), -- Use a generic placeholder
    -- Generate a unique placeholder phone number using a portion of the user's UUID
    phone_number = COALESCE(phone_number, 'PH-' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 10))
WHERE
    first_name IS NULL OR last_name IS NULL OR phone_number IS NULL OR title IS NULL;

-- 4. Add NOT NULL constraints
ALTER TABLE public.users
ALTER COLUMN title SET NOT NULL,
ALTER COLUMN first_name SET NOT NULL,
ALTER COLUMN last_name SET NOT NULL,
ALTER COLUMN phone_number SET NOT NULL;

-- 5. Add UNIQUE constraints
--    Note: users_employee_id_key might also cause issues if employee_id was null for multiple users
--    and COALESCE(employee_id, 'EMP-' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 10)) was not used.
--    If employee_id also causes a unique constraint violation, a similar approach will be needed.
ALTER TABLE public.users
ADD CONSTRAINT users_employee_id_key UNIQUE (employee_id),
ADD CONSTRAINT users_phone_number_key UNIQUE (phone_number);

-- 6. Add check constraint for title
ALTER TABLE public.users
ADD CONSTRAINT users_title_check CHECK (title = ANY (ARRAY['Mr'::text, 'Mrs'::text, 'Ms'::text, 'Dr'::text]));
