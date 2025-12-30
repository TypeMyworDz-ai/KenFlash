// supabase/functions/verify-korapay-payment/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.5';

// Initialize Supabase client for the Edge Function
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use the service role key for database writes
);

serve(async (req) => {
  const allowedOrigins = [
    'http://localhost:3000',
    'https://ken-flash.vercel.app'
  ];
  const origin = req.headers.get('Origin');
  let accessControlAllowOrigin = 'null';
  if (origin && allowedOrigins.includes(origin)) {
    accessControlAllowOrigin = origin;
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': accessControlAllowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  const { transactionId, email, planName } = await req.json();

  if (!transactionId || !email || !planName) {
    return new Response(JSON.stringify({ error: 'Missing required parameters: transactionId, email, planName' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  const KORAPAY_SECRET_KEY = Deno.env.get('KORAPAY_SECRET_KEY');
  if (!KORAPAY_SECRET_KEY) {
    console.error('KORAPAY_SECRET_KEY is not set as a Supabase secret.');
    return new Response(JSON.stringify({ error: 'Server configuration error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }

  console.log(`Attempting to list recent Korapay transactions for diagnosis.`);
  console.log(`Korapay Secret Key (first 5 chars): ${KORAPAY_SECRET_KEY.substring(0, 5)}...`);

  try {
    // --- MODIFIED: Use /merchant/api/v1/pay-ins endpoint for listing transactions ---
    const korapayListTransactionsEndpoint = `https://api.korapay.com/merchant/api/v1/pay-ins`; 
    
    // Add some query parameters to get recent successful KES transactions for debugging
    const listQueryParams = new URLSearchParams({
        'limit': '10', // Fetch a few recent transactions
        'currency': 'KES', // Filter by KES
        'status': 'success', // Only look for successful payments
        // You can add date_from/date_to if needed, e.g., for the last hour
        // 'date_from': new Date(Date.now() - 3600 * 1000).toISOString().split('.')[0] + 'Z', 
    });

    const korapayApiUrl = `${korapayListTransactionsEndpoint}?${listQueryParams.toString()}`;
    console.log(`Making GET request to Korapay API (list transactions): ${korapayApiUrl}`);

    const korapayResponse = await fetch(korapayApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Korapay API HTTP Status (list transactions): ${korapayResponse.status} ${korapayResponse.statusText}`);

    const rawKorapayResponseText = await korapayResponse.text();
    console.log('Korapay API raw response text (list transactions, before JSON parse):', rawKorapayResponseText);

    if (!korapayResponse.ok) {
      console.error(`Korapay API HTTP status error (list transactions): ${korapayResponse.status} ${korapayResponse.statusText}`);
      console.error('Korapay error response body (list transactions, raw):', rawKorapayResponseText);
      return new Response(JSON.stringify({ success: false, error: `Korapay list transactions failed (HTTP Status: ${korapayResponse.status})` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let korapayListData;
    try {
      korapayListData = JSON.parse(rawKorapayResponseText);
      console.log('Korapay API raw response (list transactions, JSON parsed):', JSON.stringify(korapayListData, null, 2));
    } catch (jsonError) {
      console.error('Failed to parse Korapay API response (list transactions) as JSON:', jsonError);
      console.error('Non-JSON Korapay response (list transactions) received:', rawKorapayResponseText);
      return new Response(JSON.stringify({ success: false, error: 'Korapay list transactions returned non-JSON response' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // --- TEMPORARY: Instead of verifying, we'll return the list of transactions for inspection ---
    // This part is for diagnosis only. We will revert/change this after we understand the data.
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Korapay transactions listed for diagnosis. Check logs!',
      korapayTransactions: korapayListData.data, // Return the data array from Korapay's response
      sentTransactionId: transactionId // Also return the transactionId we were looking for
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
    // --- END MODIFIED ---

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
