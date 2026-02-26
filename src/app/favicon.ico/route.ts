import { NextResponse } from 'next/server';

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAvUlEQVRYR+2WwQqAIBBFp0x0/3f2m0K2kFq4g0yLw0c1w4p4ZC2gkD4H8qz8WcG0cR3Q0cE6wQqQZQZQjJ1iS8j2o4l0c0yq9gQm0m0aQ5o2bJgWcYp6nU6bYlYxSx9C9uQb8iS7p0mVv7QyqQv5Q9Gk8c6Jc3qv8h9m0E6oM1n1Jb0Q9t8lqg2Q0gQAAAABJRU5ErkJggg==';

export function GET() {
  const bytes = Buffer.from(PNG_BASE64, 'base64');

  return new NextResponse(bytes, {
    headers: {
      'content-type': 'image/png',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
