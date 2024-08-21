import { addDays, startOfDay, subDays } from "date-fns";
import { AggregatedAnalytics } from "../types/types";
import { UTCDate } from "@date-fns/utc";

export const fillMissingDaysBetweenDates = (data: AggregatedAnalytics[], startDate: Date, endDate: Date) => {
    console.log('data input', data)
    const dataStartsAt = new UTCDate(data[0].timestamp);
    const dataEndsAt = new UTCDate(data[data.length - 1].timestamp);
    const today = startOfDay(new UTCDate());

    const missingDates = [];
    // if data starts after the start date, add missing dates before the data starts
    if (dataStartsAt > startDate) {
        for (let i = 0; i < dataStartsAt.getDate() - startDate.getDate(); i++) {
            const timestamp = subDays(startDate, i).toISOString();
            console.log('adding timestamp before', timestamp)
            missingDates.push({
                timestamp,
                count: 0,
            });
        }
    }

    // if data ends before the end date, add missing dates after the data ends
    if (dataEndsAt < endDate) {
        for (let i = 0; i < endDate.getDate() - dataEndsAt.getDate(); i++) {
            const timestamp = addDays(endDate, i).toISOString();
            console.log('adding timestamp after ', timestamp)
            missingDates.push({
                timestamp,
                count: 0,
            });
        }
    }

    const missingDatesBetweenStartAndEnd = [];
    for (let i = 0; i < data.length; i++) {
        const currentDate = new UTCDate(data[i].timestamp);
        if (i + 1 < data.length) {
            const nextDate = new UTCDate(data[i + 1].timestamp);
            const diff = nextDate.getDate() - currentDate.getDate();
            if (diff > 1) {
                for (let j = 1; j < diff; j++) {
                    missingDatesBetweenStartAndEnd.push({
                        timestamp: subDays(new UTCDate(currentDate), j).toISOString(),
                        count: 0,
                    });
                }
            }
        }
    }

    data = [...missingDates, ...data, ...missingDatesBetweenStartAndEnd];
    const sorted = data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return sorted;
};