const axios = require('axios');

const fapshi = {
    apiuser: (process.env.FAPSHI_APIUSER || '').trim(),
    apikey: (process.env.FAPSHI_APIKEY || '').trim(),
    baseUrl: (process.env.FAPSHI_BASE_URL || 'https://live.fapshi.com').trim().replace(/\/$/, ''),

    async initiatePay(payment) {
        if (!this.apiuser || !this.apikey) {
            throw new Error('Fapshi API credentials not configured. Set FAPSHI_APIUSER and FAPSHI_APIKEY in .env');
        }

        const isSandboxUrl = this.baseUrl.includes('sandbox');
        const isSandboxKey = this.apikey.toLowerCase().includes('test');

        if (isSandboxUrl && !isSandboxKey && this.apikey.startsWith('FAK_')) {
            console.warn('WARNING: Using LIVE key with SANDBOX URL');
        }
        if (!isSandboxUrl && isSandboxKey) {
            console.warn('WARNING: Using SANDBOX key with LIVE URL');
        }

        try {
            const response = await axios.post(`${this.baseUrl}/initiate-pay`, payment, {
                headers: {
                    'apiuser': this.apiuser,
                    'apikey': this.apikey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });
            return response.data;
        } catch (error) {
            const errorData = error.response?.data || { message: error.message };
            console.error('Fapshi initiatePay failed:', errorData);
            throw error;
        }
    },

    async getPaymentStatus(transId) {
        if (!this.apiuser || !this.apikey) {
            throw new Error('Fapshi API credentials not configured');
        }

        try {
            const response = await axios.get(`${this.baseUrl}/payment-status/${transId}`, {
                headers: {
                    'apiuser': this.apiuser,
                    'apikey': this.apikey
                },
                timeout: 15000
            });
            return response.data;
        } catch (error) {
            console.error(`Fapshi status check failed for ${transId}:`, error.response?.data || error.message);
            throw error;
        }
    }
};

module.exports = fapshi;
