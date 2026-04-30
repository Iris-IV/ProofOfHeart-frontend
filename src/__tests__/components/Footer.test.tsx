import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import Footer from '@/components/Footer';

jest.mock('@/i18n/routing', () => ({
  Link: jest.fn(({ href, children, ...props }: ComponentProps<'a'>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  )),
}));

const localizedLinkMock = jest.requireMock('@/i18n/routing').Link as jest.Mock;

describe('Footer', () => {
  beforeEach(() => {
    localizedLinkMock.mockClear();
  });

  it('uses locale-aware links for internal product navigation', () => {
    render(<Footer />);

    expect(localizedLinkMock).toHaveBeenCalledTimes(3);
    expect(localizedLinkMock.mock.calls.map(([props]) => props.href)).toEqual([
      '/',
      '/causes',
      '/about',
    ]);
  });

  it('renders a clean copyright notice', () => {
    render(<Footer />);

    expect(screen.getByText(/Copyright|©/)).toHaveTextContent(
      `© ${new Date().getFullYear()} ProofOfHeart. All rights reserved.`
    );
  });
});
