import api from '@/lib/api';

export const wishlistService = {
  async getWishlist() {
    const response = await api.get('/wishlist');
    return response.data.data || response.data;
  },

  async addToWishlist(courseId: string) {
    const response = await api.post('/wishlist', { courseId });
    return response.data;
  },

  async removeFromWishlist(courseId: string) {
    const response = await api.delete(`/wishlist/${courseId}`);
    return response.data;
  },
};
