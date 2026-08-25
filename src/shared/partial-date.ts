import type { DatePrecision, PartialDate } from './types';

export interface DatePartsVisibility {
  day: boolean;
  month: boolean;
  year: boolean;
}

export function datePartsVisibility(precision: DatePrecision): DatePartsVisibility {
  switch (precision) {
    case 'unknown':
      return { day: false, month: false, year: false };
    case 'year':
      return { day: false, month: false, year: true };
    case 'month':
      return { day: false, month: true, year: true };
    case 'exact':
    case 'circa':
    case 'before':
    case 'after':
      return { day: true, month: true, year: true };
  }
}

export function trimPartialDateForPrecision(date: PartialDate): PartialDate {
  const vis = datePartsVisibility(date.precision);
  return {
    ...date,
    day: vis.day ? date.day : null,
    month: vis.month ? date.month : null,
    year: vis.year ? date.year : null
  };
}
