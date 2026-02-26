import type { ComponentPropsWithoutRef, ReactNode } from 'react';

import { slugifyHeading } from './slug';

type HeadingProps = {
  as: 'h2' | 'h3';
  children?: ReactNode;
} & ComponentPropsWithoutRef<'h2'>;

function Heading({ as, children, ...props }: HeadingProps) {
  const text = typeof children === 'string' ? children : '';
  const id = text ? slugifyHeading(text) : undefined;
  const Tag = as;
  return (
    <Tag id={id} {...props}>
      {children}
    </Tag>
  );
}

export const mdxComponents = {
  h2: (props: ComponentPropsWithoutRef<'h2'>) => <Heading as="h2" {...props} />,
  h3: (props: ComponentPropsWithoutRef<'h3'>) => <Heading as="h3" {...props} />,
};
