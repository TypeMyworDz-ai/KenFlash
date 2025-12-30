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
  console.log(`Korapay Secret Key (first 5 chars): ${KORAPAY_SECRET_KEY.substring(0, 5)}...`); // Log part of the key for confirmation

  try {
    const korapayTransactionsEndpoint = 'https://api.korapay.com/v1/transactions';
    const expectedAmountInMinorUnits = 20 * 100; // KES 20.00 * 100 = 2000 (Korapay expects minor units)

    const queryParams = new URLSearchParams({
      'payment_reference': transactionId, 
      'status': 'success', 
      'customer_email': email, 
      'amount': expectedAmountInMinorUnits.toString(), 
      'currency': 'KES', 
      'limit': '10', 
    });

    const korapayApiUrl = `${korapayTransactionsEndpoint}?${queryParams.toString()}`;
    console.log(`Making GET request to Korapay API: ${korapayApiUrl}`); // Log the exact URL being called

    const korapayVerifyResponse = await fetch(korapayApiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    // --- ADDED: Log raw response text before attempting JSON parse ---
    const rawKorapayResponseText = await korapayVerifyResponse.text();
    console.log('Korapay API raw response text (before JSON parse):', rawKorapayResponseText);

    if (!korapayVerifyResponse.ok) {
      console.error(`Korapay API HTTP status error: ${korapayVerifyResponse.status} ${korapayVerifyResponse.statusText}`);
      console.error('Korapay error response body (raw):', rawKorapayResponseText); // Log raw text on error
      return new Response(JSON.stringify({ success: false, error: 'Korapay payment verification failed (HTTP error)' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let korapayData;
    try {
      korapayData = JSON.parse(rawKorapayResponseText); // Manually parse after logging raw text
      console.log('Korapay API raw response (JSON parsed):', JSON.stringify(korapayData, null, 2));
    } catch (jsonError) {
      console.error('Failed to parse Korapay API response as JSON:', jsonError);
      console.error('Non-JSON Korapay response received:', rawKorapayResponseText);
      return new Response(JSON.stringify({ success: false, error: 'Korapay returned non-JSON response' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    // --- END ADDED logging and manual JSON parsing ---

    let isPaymentSuccessful = false;
    let korapayReference = null;

    if (korapayData && Array.isArray(korapayData.data)) {
        const foundTransaction = korapayData.data.find((tx: any) =>
            tx.status === 'success' && 
            tx.customer?.email === email && 
            tx.payment_reference === transactionId &&
            tx.amount === expectedAmountInMinorUnits 
        );

        if (foundTransaction) {
            isPaymentSuccessful = true;
            korapayReference = foundTransaction.id;
            console.log(`Payment confirmed successful by Korapay for reference: ${korapayReference}`);
        } else {
            console.warn(`Payment not found or not successful for transactionId: ${transactionId}. Filtered Korapay response data:`, korapayData.data);
        }
    } else {
        console.warn('Korapay API response did not contain an array of transactions in data field or was unexpected. Response:', korapayData);
    }

    if (!isPaymentSuccessful) {
      return new Response(JSON.stringify({ success: false, error: 'Payment not confirmed by Korapay' }), {
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
