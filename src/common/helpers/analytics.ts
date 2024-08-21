import { subDays } from "date-fns";
import { AggregatedAnalytics } from "../types/types";
import sortBy from "lodash.sortby";

export const fillMissingDaysBetweenDates = (data: AggregatedAnalytics[], startDate: Date, endDate: Date) => {
    console.log('data input', data)
    const dataStartsAt = new Date(data[0].timestamp);
    const dataEndsAt = new Date(data[data.length - 1].timestamp);

    let missingDates = [];
    if (dataStartsAt > startDate) {
        for (let i = 0; i < dataStartsAt.getDate() - startDate.getDate(); i++) {
            missingDates.push({
                timestamp: subDays(new Date(dataStartsAt.setHours(0, 0, 0, 0)), i).toISOString(),
                count: 0,
            });
        }
    }

    if (dataEndsAt < endDate) {
        for (let i = 0; i < endDate.getDate() - dataEndsAt.getDate(); i++) {
            missingDates.push({
                timestamp: new Date(startDate).toISOString(),
                count: 0,
            });
        }
    }

    const missingDatesBetweenStartAndEnd = [];
    // find missing dates between start and end
    for (let i = 0; i < data.length; i++) {
        const currentDate = new Date(data[i].timestamp);
        if (i + 1 < data.length) {
            const nextDate = new Date(data[i + 1].timestamp);
            const diff = nextDate.getDate() - currentDate.getDate();
            if (diff > 1) {
                for (let j = 1; j < diff; j++) {
                    missingDatesBetweenStartAndEnd.push({
                        timestamp: subDays(new Date(currentDate), j).toISOString(),
                        count: 0,
                    });
                }
            }
        }
    }

    data = [...missingDates, ...data, ...missingDatesBetweenStartAndEnd];
    console.log('data output', sortBy(data, "timestamp"))
    return sortBy(data, "timestamp");
};