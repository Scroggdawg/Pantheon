// This file previously handled Supabase auth session refresh in middleware.
// Auth is now handled by a simple password gate (pantheon_session cookie).
// Supabase is used only for database queries via server.ts and client.ts.
