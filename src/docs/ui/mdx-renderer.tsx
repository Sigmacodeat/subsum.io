'use client';

import { MDXProvider } from '@mdx-js/react';
import type { ComponentType } from 'react';

import { mdxComponents } from '@/docs/mdx-components';

export default function MdxRenderer({
  Component,
}: {
  Component: ComponentType;
}) {
  return (
    <MDXProvider components={mdxComponents}>
      <Component />
    </MDXProvider>
  );
}
