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
    const sessionParams = {
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl
    };

    // Allow passing metadata (e.g. uid) from client to attach to the Checkout session
    if (body && body.uid) {
      sessionParams.metadata = Object.assign({}, body.metadata || {}, { uid: String(body.uid) });
    } else if (body && body.metadata) {
      sessionParams.metadata = body.metadata;
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // If called via GET (popup href) redirect immediately
    if (event.httpMethod === 'GET') {
      return {
        statusCode: 302,
        headers: { Location: session.url }
      };
    }

    // If called via POST (fetch from client), return the session URL as JSON
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    console.error('create-checkout-session error', err);
    return { statusCode: 500, body: String(err.message || err) };
  }
};
