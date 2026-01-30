const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async function(event) {
  // Support both GET (convenience popup open) and POST (recommended) methods.
  let body = {};
  if (event.httpMethod === 'POST') {
    try { body = JSON.parse(event.body || '{}'); } catch (e) { body = {}; }
  } else if (event.httpMethod === 'GET') {
    body = event.queryStringParameters || {};
  } else {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const priceId = body.priceId || process.env.STRIPE_PRICE_ID;
  const successUrl = process.env.STRIPE_SUCCESS_URL || `${process.env.SITE_URL || ''}/success.html`;
  const cancelUrl = process.env.SITE_URL ? `${process.env.SITE_URL}/slot_machine.html` : (body.cancelUrl || '/slot_machine.html');

  if (!priceId) {
    return { statusCode: 400, body: 'Missing priceId and STRIPE_PRICE_ID not configured' };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    // Redirect the client to Stripe Checkout
    return {
      statusCode: 302,
      headers: { Location: session.url }
    };
  } catch (err) {
    console.error('create-checkout-session error', err);
    return { statusCode: 500, body: String(err.message || err) };
  }
};
