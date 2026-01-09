-- Drop the existing policy if it was partially created or causing issues
DROP POLICY IF EXISTS "Security Guard Bypass Security Check" ON public.orders;

CREATE POLICY "Security Guard Bypass Security Check" ON public.orders
FOR UPDATE TO authenticated
USING (
    (get_user_role() = 'Security Guard'::text) AND
    (status = 'Security Check Incomplete'::text)
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.orders AS new_orders_alias -- Alias NEW as a table for the subquery
        WHERE new_orders_alias.id = orders.id -- Link to the current row being updated
          AND new_orders_alias.status = 'Security Check Bypassed Due to Off Hours'::text
          AND get_user_role() = 'Security Guard'::text
    )
);
