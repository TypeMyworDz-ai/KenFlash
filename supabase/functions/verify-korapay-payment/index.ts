// supabase/functions/verify-korapay-payment/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.5';

// Initialize Supabase client for the Edge Function
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Use the service role key for database writes
);

serve(async (req) => {
  // Define allowed origins for CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'https://ken-flash.vercel.app' // ADDED: Your Vercel domain
  ];

  // Get the origin from the request headers
  const origin = req.headers.get('Origin');
  let accessControlAllowOrigin = 'null'; // Default or a safe fallback

  // If the request origin is in our allowed list, use it for the ACAO header
  if (origin && allowedOrigins.includes(origin)) {
    accessControlAllowOrigin = origin;
  }

  // CORS Headers Configuration
  const corsHeaders = {
    'Access-Control-Allow-Origin': accessControlAllowOrigin, // Dynamically set origin
    'Access-Control-Allow-Methods': 'POST, OPTIONS', // Only allow POST for this function, and OPTIONS for preflight
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
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

    const korapayVerifyResponse = await fetch(`${korapayTransactionsEndpoint}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!korapayVerifyResponse.ok) {
      console.error(`Korapay API error: ${korapayVerifyResponse.status} ${korapayVerifyResponse.statusText}`);
      const errorBody = await korapayVerifyResponse.text();
      console.error('Korapay error response:', errorBody);
      return new Response(JSON.stringify({ success: false, error: 'Korapay payment verification failed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    const korapayData = await korapayVerifyResponse.json();
    console.log('Korapay API raw response:', JSON.stringify(korapayData, null, 2));

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
