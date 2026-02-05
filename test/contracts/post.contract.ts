import { expect } from 'vitest';

export const expectValidPost = (post: any) => {
  expect(post).toHaveProperty('id');
  expect(post).toHaveProperty('slug');
  expect(post).toHaveProperty('title');
  expect(post).toHaveProperty('createdAt');
  expect(typeof post.id).toBe('number');
};