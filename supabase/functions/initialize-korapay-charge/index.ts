// supabase/functions/initialize-korapay-charge/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// CORS Headers for this function
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // IMPORTANT: In production, change '*' to your actual frontend domain(s)
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

  const { email, planName, amount, transactionId } = await req.json();

  if (!email || !planName || !amount || !transactionId) {
    return new Response(JSON.stringify({ error: 'Missing required parameters: email, planName, amount, transactionId' }), {
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

  console.log(`Initializing Korapay charge for email: ${email}, plan: ${planName}, amount: ${amount}, transactionId: ${transactionId}`);
  console.log(`Korapay Secret Key (first 5 chars): ${KORAPAY_SECRET_KEY.substring(0, 5)}...`);

  try {
    const korapayInitializeChargeEndpoint = 'https://api.korapay.com/merchant/api/v1/charges/initialize';
    const amountInMinorUnits = amount * 100; // Korapay expects amount in minor units (e.g., KES 20.00 -> 2000)

    // IMPORTANT: Set your actual app's homepage URL for the redirect.
    // This is where Korapay will send the user back AFTER payment, with Korapay's 'reference' in the URL.
    const redirectUrl = 'https://ken-flash.vercel.app/'; // REPLACE with your actual production URL or 'http://localhost:3000' for local dev
    const notificationUrl = 'https://ken-flash.vercel.app/webhook-korapay'; // Optional: your webhook endpoint if you set one up

    const payload = {
      amount: amountInMinorUnits,
      currency: 'KES', // Your currency
      reference: transactionId, // Use our generated transactionId as Korapay's 'reference'
      description: `${planName} Content Access`,
      redirect_url: redirectUrl,
      notification_url: notificationUrl, // Optional
      customer: {
        email: email,
        name: 'Draftey Customer', // You can pass a real name if available
      },
      metadata: { // You can pass additional metadata
        plan_name: planName,
        user_email: email,
      },
      merchant_bears_cost: true, // Example: Merchant bears the cost
    };

    console.log('Korapay Initialize Charge Payload:', JSON.stringify(payload, null, 2));

    const korapayResponse = await fetch(korapayInitializeChargeEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KORAPAY_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    console.log(`Korapay Initialize Charge HTTP Status: ${korapayResponse.status} ${korapayResponse.statusText}`);

    const rawKorapayResponseText = await korapayResponse.text();
    console.log('Korapay Initialize Charge raw response text:', rawKorapayResponseText);

    if (!korapayResponse.ok) {
      console.error(`Korapay Initialize Charge API error: ${korapayResponse.status} ${korapayResponse.statusText}`);
      console.error('Korapay Initialize Charge error response body (raw):', rawKorapayResponseText);
      return new Response(JSON.stringify({ success: false, error: `Korapay charge initiation failed (HTTP Status: ${korapayResponse.status})` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    let korapayData;
    try {
      korapayData = JSON.parse(rawKorapayResponseText);
      console.log('Korapay Initialize Charge response (JSON parsed):', JSON.stringify(korapayData, null, 2));
    } catch (jsonError) {
      console.error('Failed to parse Korapay Initialize Charge response as JSON:', jsonError);
      return new Response(JSON.stringify({ success: false, error: 'Korapay returned non-JSON response for charge initiation' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    if (korapayData.status === true && korapayData.data?.checkout_url) {
      console.log(`Korapay Checkout URL received: ${korapayData.data.checkout_url}`);
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Charge initiated successfully',
        checkoutUrl: korapayData.data.checkout_url,
        korapayReference: korapayData.data.reference // Korapay's reference for this transaction
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    } else {
      console.error('Korapay Initialize Charge response did not contain a valid checkout_url:', korapayData);
      return new Response(JSON.stringify({ success: false, error: korapayData.message || 'Failed to get checkout URL from Korapay' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Internal server error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
