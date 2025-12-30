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

  // MODIFIED: Destructure 'amount' from the request body
  const { transactionId, email, planName, amount } = await req.json();

  if (!transactionId || !email || !planName || !amount) { // MODIFIED: Check for amount presence
    return new Response(JSON.stringify({ error: 'Missing required parameters: transactionId, email, planName, amount' }), {
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
  console.log(`Expected amount for verification: ${amount} KES`); // ADDED: Log the received amount

  try {
    const korapayListTransactionsEndpoint = `https://api.korapay.com/merchant/api/v1/pay-ins`; 
    
    // MODIFIED: Use the received 'amount' for comparison
    const expectedAmountInFloat = parseFloat(amount.toString()).toFixed(2); // Ensure it's "20.00" string format

    const listQueryParams = new URLSearchParams({
        'limit': '50',
        'currency': 'KES',
        'status': 'success',
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

    let isPaymentSuccessful = false;
    let korapayReference = null;

    if (korapayListData && korapayListData.status === true && Array.isArray(korapayListData.data?.payins)) {
        const foundTransaction = korapayListData.data.payins.find((tx: any) =>
            tx.status === 'success' && 
            tx.reference === transactionId &&
            tx.amount === expectedAmountInFloat && // MODIFIED: Use the received amount for comparison
            tx.currency === 'KES'
        );

        if (foundTransaction) {
            isPaymentSuccessful = true;
            korapayReference = foundTransaction.reference;
            console.log(`Payment confirmed successful by Korapay for reference: ${korapayReference}`);
        } else {
            console.warn(`Payment not found or not successful for transactionId: ${transactionId}. Filtered Korapay payins data:`, korapayListData.data.payins);
        }
    } else {
        console.warn('Korapay API response did not indicate success or had unexpected structure for payins. Response:', korapayListData);
    }

    if (!isPaymentSuccessful) {
      return new Response(JSON.stringify({ success: false, error: 'Payment not confirmed by Korapay. Please ensure payment was completed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 402,
      });
    }

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
