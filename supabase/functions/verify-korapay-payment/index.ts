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
    // --- MODIFIED: Use the correct Korapay verification endpoint ---
    const korapayVerificationEndpoint = `https://api.korapay.com/merchant/api/v1/charges/${transactionId}`; 
    console.log(`Making GET request to Korapay API: ${korapayVerificationEndpoint}`);

    const korapayVerifyResponse = await fetch(korapayVerificationEndpoint, {
      method: 'GET', // As per documentation
      headers: {
        'Authorization': `Bearer ${KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`Korapay API HTTP Status: ${korapayVerifyResponse.status} ${korapayVerifyResponse.statusText}`);

    const rawKorapayResponseText = await korapayVerifyResponse.text();
    console.log('Korapay API raw response text (before JSON parse):', rawKorapayResponseText);

    if (!korapayVerifyResponse.ok) {
      console.error(`Korapay API HTTP status error: ${korapayVerifyResponse.status} ${korapayVerifyResponse.statusText}`);
      console.error('Korapay error response body (raw):', rawKorapayResponseText);
      return new Response(JSON.stringify({ success: false, error: `Korapay payment verification failed (HTTP Status: ${korapayVerifyResponse.status})` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let korapayData;
    try {
      korapayData = JSON.parse(rawKorapayResponseText);
      console.log('Korapay API raw response (JSON parsed):', JSON.stringify(korapayData, null, 2));
    } catch (jsonError) {
      console.error('Failed to parse Korapay API response as JSON:', jsonError);
      console.error('Non-JSON Korapay response received:', rawKorapayResponseText);
      return new Response(JSON.stringify({ success: false, error: 'Korapay returned non-JSON response' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }
    // --- END MODIFIED ---

    let isPaymentSuccessful = false;
    let korapayReference = null;
    const expectedAmountInMinorUnits = 20 * 100; // KES 20.00 * 100 = 2000

    // --- MODIFIED: Adjust parsing logic based on sample response ---
    if (korapayData && korapayData.status === true && korapayData.data) {
        const transactionData = korapayData.data;
        // The sample response shows amount as string "10.00", so convert to number for comparison
        const actualAmountPaid = parseFloat(transactionData.amount) * 100; // Assuming it's in major units in response

        if (transactionData.status === 'success' && 
            transactionData.customer?.email === email && 
            transactionData.reference === transactionId && // The response has 'reference' field
            actualAmountPaid === expectedAmountInMinorUnits 
        ) {
            isPaymentSuccessful = true;
            korapayReference = transactionData.reference; // Use Korapay's reference from the response
            console.log(`Payment confirmed successful by Korapay for reference: ${korapayReference}`);
        } else {
            console.warn(`Payment not found or not successful for transactionId: ${transactionId}. Korapay response data:`, transactionData);
        }
    } else {
        console.warn('Korapay API response did not indicate success or had unexpected structure. Response:', korapayData);
    }
    // --- END MODIFIED parsing logic ---

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
