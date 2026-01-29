
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ihwtjdujflbcuorldeir.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlod3RqZHVqZmxiY3VvcmxkZWlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODcyNDUsImV4cCI6MjA4MTU2MzI0NX0.RyWMKLeY26zpdHtSIwEzup5p3xdECJJsSqfiWbMTUg0';

// Service Role Key (للعمليات الإدارية فقط - خطر في الـ Frontend!)
// ⚠️ تحذير: في الإنتاج، يجب نقل عمليات الـ admin إلى Edge Functions
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// Client للاستخدام العام
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client للعمليات الإدارية
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
        storageKey: 'sb-admin-auth' // Use a different key to avoid conflicts
    }
});

// استخدم supabaseAdmin فقط للعمليات الإدارية التي تتطلب صلاحيات عالية
