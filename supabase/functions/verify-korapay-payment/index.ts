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

  console.log(`Verifying payment for transaction ID: ${transactionId} via Korapay API.`);
  console.log(`Korapay Secret Key (first 5 chars): ${KORAPAY_SECRET_KEY.substring(0, 5)}...`);

  try {
    // Use /merchant/api/v1/pay-ins endpoint to list transactions
    const korapayListTransactionsEndpoint = `https://api.korapay.com/merchant/api/v1/pay-ins`; 
    
    // Query parameters to filter and limit results
    const listQueryParams = new URLSearchParams({
        'limit': '50', // Fetch a reasonable number of recent transactions
        'currency': 'KES', // Filter by KES
        'status': 'success', // Only look for successful payments
        // You can add date_from/date_to if needed for a smaller window
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

    // --- FINAL VERIFICATION LOGIC: Find matching transaction ---
    let isPaymentSuccessful = false;
    let korapayReference = null;
    const expectedAmountInFloat = parseFloat(PLAN_AMOUNT_KES.toString()).toFixed(2); // Match Korapay's string format "20.00"

    if (korapayListData && korapayListData.status === true && Array.isArray(korapayListData.data?.payins)) {
        const foundTransaction = korapayListData.data.payins.find((tx: any) =>
            tx.status === 'success' && // Ensure transaction is successful
            tx.reference === transactionId && // Match our unique transaction ID (which Korapay calls 'reference')
            tx.amount === expectedAmountInFloat && // Match the amount, ensuring string comparison for "20.00"
            tx.currency === 'KES' // Confirm currency
            // Korapay's /pay-ins endpoint response doesn't seem to have customer.email directly in the payin object
            // So we rely on the transactionId and amount for now.
        );

        if (foundTransaction) {
            isPaymentSuccessful = true;
            korapayReference = foundTransaction.reference; // Use Korapay's reference from the response
            console.log(`Payment confirmed successful by Korapay for reference: ${korapayReference}`);
        } else {
            console.warn(`Payment not found or not successful for transactionId: \${transactionId}. Filtered Korapay payins data:`, korapayListData.data.payins);
        }
    } else {
        console.warn('Korapay API response did not indicate success or had unexpected structure for payins. Response:', korapayListData);
    }

    if (!isPaymentSuccessful) {
      return new Response(JSON.stringify({ success: false, error: 'Payment not confirmed by Korapay. Please ensure payment was completed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402, // Payment Required
      });
    }

    // If payment is confirmed, record subscription in Supabase
    const now = new Date();
    let expiryTime;

    if (planName === '1 Day Plan') {
      expiryTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    } else if (planName === '2 Hour Plan') {
      expiryTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    } else {
      throw new Error('Unknown plan name received by Edge Function.');
    }

    const { data, error: insertError } = await supabase
      .from('subscriptions')
      .insert([
        {
          email: email,
          plan: planName,
          expiry_time: expiryTime.toISOString(),
          transaction_ref: korapayReference || transactionId,
          status: 'active',
        },
      ])
      .select();

    if (insertError) {
      console.error('Supabase subscription INSERT error:', insertError);
      return new Response(JSON.stringify({ success: false, error: 'Failed to record subscription in database' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('Subscription successfully recorded:', data);

    return new Response(JSON.stringify({ success: true, message: 'Subscription activated' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
