const axios = require('axios');
require('dotenv').config();

const API = `http://localhost:${process.env.PORT || 4001}/api`;

async function run(){
  try{
    // create a payment with sandbox test number that always succeeds (MTN: 670000000)
    const body = { registration_id: 'testreg-1', amount_cents: 5000, currency: 'XAF', phone: '670000000', email: 'test.success@fapshi.com' };
    console.log('Creating payment...', body);
    const resp = await axios.post(`${API}/payments/fapshi`, body);
    console.log('create resp:', resp.data);

    const paymentId = resp.data.payment_id;
    console.log('Opening checkout url:', resp.data.checkout_url);

    console.log('Polling status for 60 seconds... (Go to the checkout URL now and pay)');
    for(let i=0;i<30;i++){
      await new Promise(r=>setTimeout(r,2000));
      const s = await axios.get(`${API}/payments/${paymentId}`);
      console.log('status:', s.data);
      if(s.data.status === 'succeeded'){
        console.log('Payment succeeded — test complete');
        return;
      }
    }
    console.log('Test finished (no success observed) — check webhook or Fapshi sandbox behavior');
  }catch(e){
    console.error('test error', e?.response?.data || e.message);
  }
}

run();
