// supabase/functions/manage-users/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.50.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, X-Internal-Function-Token",
};

// Environment variables for the Edge Function
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const INTERNAL_USER_MANAGEMENT_TOKEN = Deno.env.get("INTERNAL_USER_MANAGEMENT_TOKEN");

Deno.serve(async (req) => {
  console.log("=== Edge Function: manage-users started ===");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // 1. Validate Internal Token for Security
    const internalTokenHeader = req.headers.get("X-Internal-Function-Token");
    if (!INTERNAL_USER_MANAGEMENT_TOKEN || internalTokenHeader !== INTERNAL_USER_MANAGEMENT_TOKEN) {
      console.error("Unauthorized: Invalid or missing internal token");
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized: Invalid internal token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Initialize Supabase Client with Service Role Key
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables for service role.");
    }
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 3. Parse Request Body
    const { action, userId, userData } = await req.json();
    console.log(`Action: ${action}, User ID: ${userId || 'N/A'}, User Data:`, userData);

    let authResponse;
    let dbResponse;

    if (action === "create") {
      // Create new user via Supabase Auth Admin API
      authResponse = await supabaseAdmin.auth.admin.createUser({
        email: userData.email || undefined,
        phone: userData.phone_number || undefined,
        password: userData.password,
        email_confirm: true, // Skip email verification for admin-created users
        user_metadata: {
          username: userData.username,
          role: userData.role,
          title: userData.title,
          first_name: userData.first_name,
          last_name: userData.last_name,
          employee_id: userData.employee_id,
          phone_number: userData.phone_number,
        },
      });

      if (authResponse.error) throw authResponse.error;
      if (!authResponse.data.user) throw new Error("User creation failed in Auth.");

      // Insert user details into public.users table
      dbResponse = await supabaseAdmin
        .from("users")
        .insert({
          id: authResponse.data.user.id,
          username: userData.username,
          email: userData.email || null,
          role: userData.role,
          password_hash: '', // This column is not used by Supabase Auth, but required by your schema
          title: userData.title,
          first_name: userData.first_name,
          last_name: userData.last_name,
          employee_id: userData.employee_id || null,
          phone_number: userData.phone_number,
        });

      if (dbResponse.error) {
        // Attempt to roll back auth user creation if DB insert fails
        await supabaseAdmin.auth.admin.deleteUser(authResponse.data.user.id);
        throw dbResponse.error;
      }

    } else if (action === "update") {
      if (!userId) throw new Error("User ID is required for update action.");

      // Update user details in public.users table
      dbResponse = await supabaseAdmin
        .from("users")
        .update({
          username: userData.username,
          role: userData.role,
          title: userData.title,
          first_name: userData.first_name,
          last_name: userData.last_name,
          employee_id: userData.employee_id || null,
          phone_number: userData.phone_number,
        })
        .eq("id", userId);

      if (dbResponse.error) throw dbResponse.error;

      // Update password via Supabase Auth Admin API if provided
      if (userData.password) {
        authResponse = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: userData.password,
        });
        if (authResponse.error) throw authResponse.error;
      }

    } else if (action === "delete") {
      if (!userId) throw new Error("User ID is required for delete action.");

      // Delete user from public.users table first (due to foreign key constraints)
      dbResponse = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", userId);

      if (dbResponse.error) throw dbResponse.error;

      // Delete user from Supabase Auth
      authResponse = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (authResponse.error) throw authResponse.error;

    } else {
      throw new Error("Invalid action specified.");
    }

    console.log("User management action completed successfully.");
    return new Response(
      JSON.stringify({ success: true, message: "User operation successful." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Edge Function error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
