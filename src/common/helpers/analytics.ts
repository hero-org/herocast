import { UTCDate } from '@date-fns/utc';
import type { AggregatedAnalytics } from '../types/types';

export const fillMissingDaysBetweenDates = (data: AggregatedAnalytics[], startDate: Date, endDate: Date) => {
  if (!data || data.length === 0) {
    return [];
  }
  const filledData: AggregatedAnalytics[] = [];
  const currentDate = new UTCDate(startDate);
  const utcEndDate = new UTCDate(endDate);

  while (currentDate < utcEndDate) {
    const existingData = data.find((item) => {
      const itemDate = new UTCDate(item.timestamp);
      return (
        itemDate.getUTCFullYear() === currentDate.getUTCFullYear() &&
        itemDate.getUTCMonth() === currentDate.getUTCMonth() &&
        itemDate.getUTCDate() === currentDate.getUTCDate()
      );
    });

    if (existingData) {
      filledData.push(existingData);
    } else {
      filledData.push({
        timestamp: currentDate.toISOString(),
        count: 0,
      });
    }

    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return filledData;
};
