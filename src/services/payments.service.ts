import api from '@/lib/api';

export interface Payment {
    id: string;
    transactionId: string;
    amount: number;
    currency: string;
    status: 'pending' | 'completed' | 'failed' | 'refunded';
    paymentMethod?: string;
    createdAt: string;
    paidAt?: string;
    course: {
        id: string;
        title: string;
        thumbnailUrl?: string;
    };
}

export interface PaymentIntent {
    paymentId: string;
    transactionId: string;
    amount: number;
    currency: string;
    clientSecret: string;
    course: {
        id: string;
        title: string;
    };
}

export interface FapshiPaymentResponse {
    paymentId: string;
    transactionId: string;
    amount: number;
    currency: string;
    status: string;
    checkoutUrl?: string;
    course: {
        id: string;
        title: string;
    };
}

export interface FapshiPaymentStatus {
    status: 'pending' | 'completed' | 'failed';
    paymentId: string;
    fapshiStatus?: string;
    error?: string;
}

export const paymentsService = {
    async createPayment(courseId: string, paymentMethod?: string): Promise<PaymentIntent> {
        const response = await api.post('/payments', { courseId, paymentMethod });
        return response.data.data;
    },

    async confirmPayment(paymentId: string, transactionId?: string): Promise<{ paymentId: string; enrollmentId: string }> {
        const response = await api.post(`/payments/${paymentId}/confirm`, { transactionId });
        return response.data.data;
    },

    async getMyPayments(): Promise<Payment[]> {
        const response = await api.get('/payments');
        return response.data.data.payments;
    },

    async getPaymentById(id: string): Promise<Payment> {
        const response = await api.get(`/payments/${id}`);
        return response.data.data;
    },

    // Fapshi mobile money payment
    async createFapshiPayment(courseId: string): Promise<FapshiPaymentResponse> {
        const response = await api.post('/payments/fapshi', { courseId });
        return response.data.data;
    },

    async checkFapshiPaymentStatus(transactionId: string): Promise<FapshiPaymentStatus> {
        const response = await api.get(`/payments/fapshi/status/${transactionId}`);
        return response.data.data;
    },
};
