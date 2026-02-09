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
};
