import { describe, expect, it } from 'vitest';
import { datePartsVisibility, trimPartialDateForPrecision } from '@shared/partial-date';
import type { PartialDate } from '@shared/types';

const filled: PartialDate = {
  precision: 'exact',
  year: 1990,
  month: 5,
  day: 12,
  hour: null,
  minute: null,
  originalText: null,
  sortKey: null
};

describe('datePartsVisibility', () => {
  it('hides all numeric parts for unknown', () => {
    expect(datePartsVisibility('unknown')).toEqual({ day: false, month: false, year: false });
  });

  it('shows only year for year precision', () => {
    expect(datePartsVisibility('year')).toEqual({ day: false, month: false, year: true });
  });

  it('shows year and month for month precision', () => {
    expect(datePartsVisibility('month')).toEqual({ day: false, month: true, year: true });
  });

  it('shows all parts for exact and qualified precisions', () => {
    for (const precision of ['exact', 'circa', 'before', 'after'] as const) {
      expect(datePartsVisibility(precision)).toEqual({ day: true, month: true, year: true });
    }
  });
});

describe('trimPartialDateForPrecision', () => {
  it('clears day and month when switching to year only', () => {
    expect(trimPartialDateForPrecision({ ...filled, precision: 'year' })).toMatchObject({
      precision: 'year',
      year: 1990,
      month: null,
      day: null
    });
  });

  it('clears day when switching to month precision', () => {
    expect(trimPartialDateForPrecision({ ...filled, precision: 'month' })).toMatchObject({
      precision: 'month',
      year: 1990,
      month: 5,
      day: null
    });
  });

  it('clears all numeric parts for unknown', () => {
    expect(trimPartialDateForPrecision({ ...filled, precision: 'unknown' })).toMatchObject({
      precision: 'unknown',
      year: null,
      month: null,
      day: null
    });
  });

  it('keeps originalText unchanged', () => {
    expect(
      trimPartialDateForPrecision({
        ...filled,
        precision: 'year',
        originalText: 'ок. 1890'
      }).originalText
    ).toBe('ок. 1890');
  });
});
