import { dateLabel, money, tripLabel } from './ui';
describe('Calendar dates and amounts', () => {
  it('keeps a calendar date unchanged across local timezone offsets', () => {
    expect(dateLabel('2026-10-10')).toBe('Oct 10, 2026');
  });
  it('formats dollars without dropping cents', () => {
    expect(money(12.5)).toBe('$12.50');
  });
  it('shows canonical planned requests as pending approval', () => {
    expect(tripLabel('PLANNED')).toBe('Pending approval');
  });
});
