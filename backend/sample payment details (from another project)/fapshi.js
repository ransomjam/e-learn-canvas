const axios = require('axios');

const fapshi = {
  apiuser: (process.env.FAPSHI_APIUSER || 'f3b6d10d-c2a7-458b-9103-69b1b9dac9de').trim(),
  apikey: (process.env.FAPSHI_APIKEY || 'FAK_b58f060abd2b77161d07c0214bfac65d').trim(),
  baseUrl: (process.env.FAPSHI_BASE_URL || 'https://live.fapshi.com').trim().replace(/\/$/, ''),

  async initiatePay(payment) {
    // Determine if we should warn about key/url mismatch
    const isSandboxUrl = this.baseUrl.includes('sandbox');
    const isSandboxKey = this.apikey.toLowerCase().includes('test');
    
    if (isSandboxUrl && !isSandboxKey && this.apikey.startsWith('FAK_')) {
      console.warn('CRITICAL: Using what looks like a LIVE key (FAK_) with a SANDBOX URL. This will likely fail.');
    }
    if (!isSandboxUrl && isSandboxKey) {
      console.warn('CRITICAL: Using a SANDBOX key with a LIVE URL. This will fail.');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/initiate-pay`, payment, {
        headers: {
          'apiuser': this.apiuser,
          'apikey': this.apikey,
          'Content-Type': 'application/json'
        },
        timeout: 500000
      });
      return response.data;
    } catch (error) {
      const errorData = error.response?.data || { message: error.message };
      console.error('Fapshi API Request Failed:', errorData);
      throw error;
    }
  },

  async getPaymentStatus(transId) {
    try {
      const response = await axios.get(`${this.baseUrl}/payment-status/${transId}`, {
        headers: {
          'apiuser': this.apiuser,
          'apikey': this.apikey
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Fapshi Status Check Failed for ${transId}:`, error.response?.data || error.message);
      throw error;
    }
  }
};

module.exports = fapshi;
