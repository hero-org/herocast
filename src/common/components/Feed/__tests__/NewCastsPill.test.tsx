/**
 * @jest-environment jsdom
 */

import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react';

import { NewCastsPill } from '../NewCastsPill';

describe('NewCastsPill', () => {
  it('hides the visible pill when count is 0 (live region stays mounted)', () => {
    render(<NewCastsPill count={0} onClick={jest.fn()} />);
    expect(screen.queryByTestId('new-casts-pill')).toBeNull();
    // Live region stays mounted with empty content so screen readers can
    // announce when count later changes from 0 to N.
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('hides the visible pill for negative counts (defensive)', () => {
    render(<NewCastsPill count={-3} onClick={jest.fn()} />);
    expect(screen.queryByTestId('new-casts-pill')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('renders singular "1 new cast" when count is 1', () => {
    render(<NewCastsPill count={1} onClick={jest.fn()} />);
    const pill = screen.getByTestId('new-casts-pill');
    expect(pill.textContent).toContain('1 new cast');
    // Make sure we are not pluralizing for count===1.
    expect(pill.textContent).not.toContain('1 new casts');
  });

  it('renders plural "5 new casts" when count is 5', () => {
    render(<NewCastsPill count={5} onClick={jest.fn()} />);
    const pill = screen.getByTestId('new-casts-pill');
    expect(pill.textContent).toContain('5 new casts');
  });

  it('fires onClick exactly once when the pill is clicked', () => {
    const handleClick = jest.fn();
    render(<NewCastsPill count={3} onClick={handleClick} />);
    fireEvent.click(screen.getByTestId('new-casts-pill'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
