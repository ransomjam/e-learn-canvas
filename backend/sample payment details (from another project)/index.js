require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 4001;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8080',
  'https://www.ubatechcamp.org',
  'https://ubatechcamp.org',
  'https://ubatechcamp-org.vercel.app',
  'https://ubatechcamp-jt7oqhsf0-jam-ransoms-projects.vercel.app',
  'https://ubatechcamp-4rlcmcgek-jam-ransoms-projects.vercel.app',
  'https://ubatechcamp-cfngww8j5-jam-ransoms-projects.vercel.app',
  'https://ubatechcamp-o74mged08-jam-ransoms-projects.vercel.app',
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(ao => origin === ao) ||
                     (origin.includes('ubatechcamp') && origin.includes('vercel.app')) ||
                     (origin.includes('jam-ransom') && origin.includes('vercel.app'));
    
    if (isAllowed) {
      return callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));

app.use(express.json());

// Root route for Render health checks
app.get('/', (req, res) => {
  res.json({ status: 'Backend is running', timestamp: new Date() });
});

// DEBUG LOGGING: This will show in Render logs
app.use((req, res, next) => {
  console.log(`Incoming Request: ${req.method} ${req.path}`);
  next();
});

const FAPSHI_BASE = (process.env.FAPSHI_BASE_URL || 'https://live.fapshi.com').trim();
const fapshi = require('./fapshi');

// Log configuration status on startup
console.log('--- Configuration Status ---');
console.log('FAPSHI_BASE_URL:', FAPSHI_BASE);
console.log('FAPSHI_APIUSER:', fapshi.apiuser);
console.log('FRONTEND_URL:', process.env.FRONTEND_URL || 'https://www.ubatechcamp.org');
console.log('---------------------------');

const payments = new Map();
const supabase = require('./supabase');

// --- Payout Logic for Ambassadors ---
async function processRecommendationPayout(transId) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

    // 1. Get the payment and its registration
    const { data: payment, error: pError } = await supabase
      .from('payments')
      .select('*, registrations(id, recommendation_code, status)')
      .eq('provider_reference', transId)
      .single();

    if (pError || !payment) {
      console.error(`Error finding payment ${transId}:`, pError?.message);
      return;
    }

    // Safety: If registration is already 'completed', don't payout again
    if (payment.registrations?.status === 'completed') {
       console.log(`Registration for payment ${transId} already marked as completed. Skipping payout.`);
       return;
    }

    if (!payment.registrations?.recommendation_code) {
      console.log(`No recommendation payout needed for ${transId}`);
      // Still need to mark registration as completed
      await supabase.from('registrations').update({ status: 'completed' }).eq('id', payment.registrations.id);
      return;
    }

    // 2. Check if already processed (find the person)
    let person = null;
    let type = null;

    // Try ambassador first
    const { data: ambassador, error: aError } = await supabase
      .from('ambassadors')
      .select('id, balance_cents, recommendation_code')
      .eq('recommendation_code', payment.registrations.recommendation_code)
      .eq('status', 'approved')
      .maybeSingle();

    if (ambassador) {
      person = ambassador;
      type = 'ambassador';
    } else {
      // Try tutor
      const { data: tutor, error: tError } = await supabase
        .from('tutors')
        .select('id, balance_cents, recommendation_code')
        .eq('recommendation_code', payment.registrations.recommendation_code)
        .eq('status', 'approved')
        .maybeSingle();
      
      if (tutor) {
        person = tutor;
        type = 'tutor';
      }
    }

    if (!person) {
      console.warn(`No approved ambassador or tutor found for code: ${payment.registrations.recommendation_code}`);
      // Still need to mark registration as completed
      await supabase.from('registrations').update({ status: 'completed' }).eq('id', payment.registrations.id);
      return;
    }

    // 4. Update the balance (Referral: 500 XAF)
    const amountToCredit = 500;
    const newBalance = Number(person.balance_cents || 0) + amountToCredit;
    
    const { error: uError } = await supabase
      .from(type === 'tutor' ? 'tutors' : 'ambassadors')
      .update({ balance_cents: newBalance })
      .eq('id', person.id);

    if (uError) {
      console.error(`Failed to update ${type} balance:`, uError.message);
    } else {
      console.log(`Successfully credited ${type} ${person.id} with ${amountToCredit} XAF for recommendation ${transId}`);
    }

    // 5. Update registration status to 'completed'
    await supabase.from('registrations').update({ status: 'completed' }).eq('id', payment.registrations.id);

  } catch (err) {
    console.error('Error in processRecommendationPayout:', err.message);
  }
}

// --- Registration Logic ---
app.post('/api/registrations', async (req, res) => {
  try {
    const data = req.body;
    console.log('Registration request received:', data.email);

    if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_service_role_key_here') {
      // Basic check for existing email to match frontend expectation (409 conflict)
      const { data: existing } = await supabase
        .from('registrations')
        .select('id')
        .eq('email', data.email)
        .maybeSingle();

      if (existing) {
        console.log('Registration conflict: email already exists', data.email);
        return res.status(409).json({ id: existing.id, message: 'Email already registered' });
      }

      // Map fields from frontend to DB schema
      const insertData = {
        full_name: data.full_name,
        email: data.email,
        phone: data.phone,
        institution: data.institution,
        field_of_study: data.field_of_study,
        program: data.program,
        recommendation_code: data.recommendation_code,
        age: data.age,
        education_level: data.education_level,
        status: 'pending_payment' // Set initial status
      };

      const { data: newReg, error } = await supabase
        .from('registrations')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Supabase Registration Error:', error.message);
        return res.status(500).json({ error: error.message });
      }

      console.log('Registration successful:', newReg.id);
      return res.status(201).json(newReg);
    } else {
      console.warn('Supabase not configured. Using Mock ID for registration.');
      return res.status(201).json({ 
        id: 'mock-reg-' + Math.random().toString(36).slice(2, 9),
        ...data 
      });
    }
  } catch (err) {
    console.error('Registration handler error:', err.message);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Mobile Money Payment Endpoint (MTN/Orange direct payment)
app.post('/api/payments/mobile', async (req, res) => {
  try {
    const { registration_id, provider, phone, amount_cents, currency } = req.body;
    
    if (!registration_id || !provider || !phone || !amount_cents) {
      return res.status(400).json({ error: 'Missing required fields: registration_id, provider, phone, amount_cents' });
    }

    if (!['mtn', 'orange'].includes(provider)) {
      return res.status(400).json({ error: 'Provider must be "mtn" or "orange"' });
    }

    // Validate and format phone number
    let phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 9) {
      return res.status(400).json({ error: 'Invalid phone number format - need at least 9 digits' });
    }

    // Remove country code if present and keep last 9 digits
    if (phoneDigits.length > 9) {
      phoneDigits = phoneDigits.slice(-9);
    }

    // Format: +237XXXXXXXXX (Cameroon country code)
    const formattedPhone = '+237' + phoneDigits;

    const payload = {
      amount: Number(amount_cents),
      phone: formattedPhone,
      userId: registration_id,
      externalId: registration_id,
      redirectUrl: `https://www.ubatechcamp.org/registration-complete`,
      message: `UBA Tech Camp Registration Fee`
    };

    console.log(`[PAYMENT] Initiating ${provider.toUpperCase()} payment:`, {
      registration_id,
      phone: formattedPhone,
      amount_cents: payload.amount,
      provider
    });

    // Call FAPSHI to initiate mobile money payment
    const data = await fapshi.initiatePay(payload);

    console.log(`[PAYMENT] FAPSHI Response:`, data);

    const paymentId = data.transId || (Math.random().toString(36).slice(2, 10));
    
    // Store payment record
    payments.set(paymentId, {
      registration_id,
      provider,
      phone: formattedPhone,
      amount: payload.amount,
      status: 'pending',
      dateInitiated: new Date().toISOString()
    });

    // Persist to Supabase
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_service_role_key_here') {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(registration_id);
        
        const { error } = await supabase.from('payments').insert([{ 
          registration_id: isUuid ? registration_id : null,
          phone: formattedPhone || null,
          amount_cents: payload.amount,
          currency: currency || 'XAF',
          provider: provider,
          status: 'pending',
          provider_reference: paymentId,
          message: payload.message
        }]);

        if (error) {
          console.error('[PAYMENT] Supabase Insert Error:', error.message);
        }
      }
    } catch (dbErr) {
      console.warn('Supabase DB error (non-critical):', dbErr.message || dbErr);
    }

    // Return payment ID for polling, not a redirect URL
    return res.json({ 
      id: paymentId,
      payment_id: paymentId,
      status: 'pending',
      message: `Please complete payment on your ${provider.toUpperCase()} phone. A prompt will appear shortly.`
    });
  } catch (err) {
    const errorData = err.response?.data || { message: err.message };
    console.error('[PAYMENT] Mobile payment error:', errorData);
    const code = err.response?.status || 500;
    const msg = errorData.message || 'Failed to initiate mobile payment';
    return res.status(code).json({ error: msg, details: errorData });
  }
});

app.post('/api/payments/fapshi', async (req, res) => {
  try {
    const { registration_id, amount_cents, currency, phone, email } = req.body;
    if (!registration_id || !amount_cents) {
      return res.status(400).json({ error: 'registration_id and amount_cents required' });
    }

    const payload = {
      amount: Number(amount_cents),
      email: email || undefined,
      phone: phone || undefined,
      userId: registration_id,
      externalId: registration_id,
      redirectUrl: `https://www.ubatechcamp.org/registration-complete`,
      message: 'Registration fee'
    };

    const data = await fapshi.initiatePay(payload);

    // Store minimal mapping
    const paymentId = data.transId || data.transId || (Math.random().toString(36).slice(2, 10));
    payments.set(paymentId, {
      registration_id,
      amount: payload.amount,
      status: 'CREATED',
      checkout_url: data.link || data.checkout_url || null,
      dateInitiated: data.dateInitiated || new Date().toISOString()
    });

    // Persist to Supabase if configured
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_service_role_key_here') {
        // Validate if registration_id is a valid UUID to avoid Postgres error
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(registration_id);
        
        const { error } = await supabase.from('payments').insert([{ 
          registration_id: isUuid ? registration_id : null,
          phone: phone || null,
          amount_cents: payload.amount,
          currency: currency || 'XAF',
          provider: 'fapshi', // Now supported by the updated enum
          status: 'created',
          provider_reference: paymentId,
          message: payload.message || (isUuid ? 'Registration fee' : `Test Payment (Orig ID: ${registration_id})`)
        }]);

        if (error) {
          console.error('CRITICAL Supabase Insert Error:', error.message, '| Hint:', error.hint, '| Details:', error.details);
          throw error;
        } else {
          console.log(`Successfully persisted payment ${paymentId} to Supabase.`);
        }
      } else {
        console.warn('Supabase not configured or using placeholder key. Skipping DB insert.');
      }
    } catch (dbErr) {
      console.error('Supabase DB Error:', dbErr.message || dbErr);
    }
    return res.json({ payment_id: paymentId, checkout_url: data.link || data.checkout_url });
  } catch (err) {
    const errorData = err.response?.data || { message: err.message };
    console.error('createFapshiPayment error', errorData);
    const code = err.response?.status || 500;
    const msg = errorData.message || 'Failed to create payment';
    return res.status(code).json({ error: msg });
  }
});

app.get('/api/payments/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id required' });

    // First attempt to query Fapshi for real status
    const data = await fapshi.getPaymentStatus(id);
    // normalize status
    const statusMap = {
      CREATED: 'created',
      PENDING: 'pending',
      SUCCESSFUL: 'succeeded',
      FAILED: 'failed',
      EXPIRED: 'expired'
    };
    const normalized = statusMap[(data.status || '').toUpperCase()] || (data.status || 'unknown');

    // update store
    const existing = payments.get(id) || {};
    payments.set(id, { ...existing, status: normalized, fapshi: data });

    // update DB record if available
    try {
      if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_service_role_key_here') {
        // Fetch current status to see if it's a new success
        const { data: currentPayment } = await supabase.from('payments').select('status').eq('provider_reference', id).single();
        
        const { error } = await supabase.from('payments').update({ status: normalized }).eq('provider_reference', id);
        if (error) console.error('Supabase DB Update Error:', error.message);

        // If it just became succeeded, process payout
        if (normalized === 'succeeded' && currentPayment?.status !== 'succeeded') {
          await processRecommendationPayout(id);
        }
      }
    } catch (dbErr) {
      console.warn('Supabase update failed:', dbErr.message || dbErr);
    }

    return res.json({ id, status: normalized, raw: data });
  } catch (err) {
    const errorData = err.response?.data || { message: err.message };
    console.error('get payment status error', errorData);
    const code = err.response?.status || 500;
    const msg = errorData.message || 'Failed to get status';
    return res.status(code).json({ error: msg });
  }
});

// Webhook endpoint that Fapshi will call
app.post('/api/webhook/fapshi', async (req, res) => {
  try {
    const body = req.body || {};
    const transId = body.transId || body.trans_id || body.id;
    if (!transId) {
      return res.status(400).json({ message: 'transId required' });
    }

    // Verify by fetching status from Fapshi
    try {
      const data = await fapshi.getPaymentStatus(transId);
      const status = (data.status || '').toUpperCase();

      const statusMap = { SUCCESSFUL: 'succeeded', FAILED: 'failed', EXPIRED: 'expired', PENDING: 'pending', CREATED: 'created' };
      const normalized = statusMap[status] || data.status || 'unknown';

      const existing = payments.get(transId) || {};
      payments.set(transId, { ...existing, status: normalized, fapshi: data });

      // update DB record if available
      try {
        if (process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY !== 'your_service_role_key_here') {
          // Fetch current status
          const { data: currentPayment } = await supabase.from('payments').select('status').eq('provider_reference', transId).single();

          const { error } = await supabase.from('payments').update({ status: normalized }).eq('provider_reference', transId);
          if (error) console.error('Supabase Webhook DB Update Error:', error.message);

          // If it just became succeeded, process payout
          if (normalized === 'succeeded' && currentPayment?.status !== 'succeeded') {
            await processRecommendationPayout(transId);
          }
        }
      } catch (dbErr) {
        console.warn('Supabase webhook update failed:', dbErr.message || dbErr);
      }
      // TODO: persist to DB / notify frontend via webhook or websocket
      console.log(`Webhook received for ${transId}: ${normalized}`);

      return res.json({ message: 'ok' });
    } catch (e) {
      console.error('Webhook verify error', e.response?.data || e.message);
      return res.status(500).json({ message: 'failed to verify' });
    }
  } catch (err) {
    console.error('webhook error', err.message);
    return res.status(500).json({ message: 'server error' });
  }
});

app.get('/api/payments/store/:id', (req, res) => {
  const id = req.params.id;
  return res.json(payments.get(id) || null);
});

// Fallback 404 handler for unknown routes
app.use((req, res) => {
  console.log(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ error: `Path ${req.path} not found on this server.` });
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
