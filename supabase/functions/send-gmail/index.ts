// import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// import { createClient } from "npm:@supabase/supabase-js@2";

// const corsHeaders = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
//   "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey"
// };

// Deno.serve(async (req) => {
//   if (req.method === "OPTIONS") {
//     return new Response(null, { status: 200, headers: corsHeaders });
//   }

//   try {
//     const supabaseUrl = Deno.env.get("SUPABASE_URL");
//     const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
//     const googleClientId = Deno.env.get("GOOGLE_CLIENT_ID");
//     const googleClientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

//     if (!supabaseUrl || !supabaseServiceKey || !googleClientId || !googleClientSecret) {
//       return new Response(JSON.stringify({
//         error: "Server configuration error"
//       }), {
//         status: 500,
//         headers: { ...corsHeaders, "Content-Type": "application/json" }
//       });
//     }

//     const supabase = createClient(supabaseUrl, supabaseServiceKey);

//     // Get authorization token
//     const authHeader = req.headers.get("Authorization");
//     if (!authHeader) {
//       return new Response(JSON.stringify({
//         error: "Missing authorization header"
//       }), {
//         status: 401,
//         headers: { ...corsHeaders, "Content-Type": "application/json" }
//       });
//     }

//     const token = authHeader.replace("Bearer ", "");

//     // Verify user
//     const { data: userData, error: userError } = await supabase.auth.getUser(token);
//     if (userError || !userData.user) {
//       return new Response(JSON.stringify({
//         error: "Invalid authentication"
//       }), {
//         status: 401,
//         headers: { ...corsHeaders, "Content-Type": "application/json" }
//       });
//     }

//     const userId = userData.user.id;
//     console.log("✅ User authenticated:", userId);

//     // CRITICAL FIX: Get the session to access provider tokens
//     // The tokens are stored in the session, not in identity_data!
//     const { data: sessionData, error: sessionError } = await supabase.auth.admin.getUserById(userId);
    
//     if (sessionError) {
//       console.error("❌ Failed to get user session:", sessionError);
//     }

//     // Try to get provider token from multiple sources
//     let providerToken = null;
//     let providerRefreshToken = null;

//     // Source 1: Check if tokens were passed in the request body
//     let payload;
//     try {
//       payload = await req.json();
//       providerToken = payload.provider_token;
//       providerRefreshToken = payload.provider_refresh_token;
      
//       if (providerToken) {
//         console.log("✅ Using provider token from request body");
//       }
//     } catch {
//       return new Response(JSON.stringify({
//         error: "Invalid JSON payload"
//       }), {
//         status: 400,
//         headers: { ...corsHeaders, "Content-Type": "application/json" }
//       });
//     }

//     // Source 2: Try identity data (fallback)
//     if (!providerToken && sessionData?.user) {
//       const identities = sessionData.user.identities || [];
//       const googleIdentity = identities.find((i) => i.provider === "google");
      
//       if (googleIdentity) {
//         providerToken = googleIdentity.identity_data?.provider_token;
//         providerRefreshToken = googleIdentity.identity_data?.provider_refresh_token;
        
//         if (providerToken) {
//           console.log("✅ Using provider token from identity data");
//         }
//       }
//     }

//     console.log("🔑 Token status:", {
//       hasProviderToken: !!providerToken,
//       hasRefreshToken: !!providerRefreshToken
//     });

//     // If we have a refresh token but no access token, refresh it
//     if (!providerToken && providerRefreshToken) {
//       console.log("🔄 Refreshing access token...");
      
//       const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
//         method: "POST",
//         headers: { "Content-Type": "application/x-www-form-urlencoded" },
//         body: new URLSearchParams({
//           client_id: googleClientId,
//           client_secret: googleClientSecret,
//           refresh_token: providerRefreshToken,
//           grant_type: "refresh_token"
//         })
//       });

//       if (refreshRes.ok) {
//         const refreshData = await refreshRes.json();
//         providerToken = refreshData.access_token;
//         console.log("✅ Token refreshed successfully");
//       } else {
//         const errText = await refreshRes.text();
//         console.error("❌ Token refresh failed:", errText);
//         return new Response(JSON.stringify({
//           error: "Failed to refresh Google token",
//           details: "Please provide tokens in request or sign in again",
//           needsReauth: true
//         }), {
//           status: 403,
//           headers: { ...corsHeaders, "Content-Type": "application/json" }
//         });
//       }
//     }

//     if (!providerToken) {
//       console.error("❌ No provider token available");
//       return new Response(JSON.stringify({
//         error: "Gmail access token required",
//         details: "Please include provider_token and provider_refresh_token in your request body",
//         needsTokens: true
//       }), {
//         status: 403,
//         headers: { ...corsHeaders, "Content-Type": "application/json" }
//       });
//     }

//     // Validate payload
//     if (!payload.recipientEmail || !payload.subject || !payload.body) {
//       return new Response(JSON.stringify({
//         error: "Missing required fields: recipientEmail, subject, or body"
//       }), {
//         status: 400,
//         headers: { ...corsHeaders, "Content-Type": "application/json" }
//       });
//     }

//     // Send email via Gmail
//     const emailContent = [
//       `To: ${payload.recipientEmail}`,
//       `Subject: ${payload.subject}`,
//       "Content-Type: text/plain; charset=utf-8",
//       "",
//       payload.body
//     ].join("\r\n");

//     const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
//       .replace(/\+/g, "-")
//       .replace(/\//g, "_")
//       .replace(/=+$/, "");

//     console.log("📤 Sending email to Gmail API...");

//     const gmailRes = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
//       method: "POST",
//       headers: {
//         "Authorization": `Bearer ${providerToken}`,
//         "Content-Type": "application/json"
//       },
//       body: JSON.stringify({ raw: encodedEmail })
//     });

//     if (!gmailRes.ok) {
//       const errorData = await gmailRes.json();
//       console.error("❌ Gmail API error:", errorData);
      
//       if (gmailRes.status === 401 || gmailRes.status === 403) {
//         return new Response(JSON.stringify({
//           error: "Gmail authorization failed",
//           details: "Token is invalid or expired. Please provide fresh tokens or sign in again.",
//           needsReauth: true,
//           gmailError: errorData
//         }), {
//           status: 403,
//           headers: { ...corsHeaders, "Content-Type": "application/json" }
//         });
//       }
      
//       return new Response(JSON.stringify({
//         error: "Gmail API error",
//         details: errorData.error?.message || "Failed to send email",
//         gmailError: errorData
//       }), {
//         status: 500,
//         headers: { ...corsHeaders, "Content-Type": "application/json" }
//       });
//     }

//     const gmailData = await gmailRes.json();
//     console.log("✅ Email sent successfully:", gmailData.id);

//     return new Response(JSON.stringify({
//       success: true,
//       messageId: gmailData.id
//     }), {
//       headers: { ...corsHeaders, "Content-Type": "application/json" }
//     });

//   } catch (err) {
//     console.error("💥 Unexpected error:", err);
//     return new Response(JSON.stringify({
//       error: "Internal server error",
//       details: err instanceof Error ? err.message : String(err)
//     }), {
//       status: 500,
//       headers: { ...corsHeaders, "Content-Type": "application/json" }
//     });
//   }
// });