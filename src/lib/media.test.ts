import { describe, it, expect } from 'vitest';
import { resolveMediaUrl } from './media';
import { API_BASE_URL } from '@/lib/api';

const origin = new URL(API_BASE_URL).origin;

describe('resolveMediaUrl', () => {
  it('returns full http/https URLs unchanged', () => {
    const url = 'https://example.com/image.jpg';
    expect(resolveMediaUrl(url)).toBe(url);
  });

  it('returns data URLs unchanged', () => {
    const url = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
    expect(resolveMediaUrl(url)).toBe(url);
  });

  it('normalizes backslashes and builds correct origin path', () => {
    const url = 'uploads\\avatars\\pic.png';
    expect(resolveMediaUrl(url)).toBe(`${origin}/uploads/avatars/pic.png`);
  });

  it('handles paths that include /api/v1/uploads/', () => {
    const url = '/api/v1/uploads/courses/thumb.jpg';
    expect(resolveMediaUrl(url)).toBe(`${origin}/uploads/courses/thumb.jpg`);
  });

  it('handles relative uploads path', () => {
    const url = 'uploads/pic.png';
    expect(resolveMediaUrl(url)).toBe(`${origin}/uploads/pic.png`);
  });

  it('handles bare filename', () => {
    const url = 'pic.png';
    expect(resolveMediaUrl(url)).toBe(`${origin}/uploads/pic.png`);
  });
});