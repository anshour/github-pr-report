// src/utils/date.ts - Date utilities
import dayjs from "dayjs";
import "dayjs/locale/id";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import localizedFormat from "dayjs/plugin/localizedFormat";

// Enable plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(localizedFormat);

// Set locale to Indonesia
dayjs.locale("id");

export const formatDate = (date: string | Date): string => {
  return dayjs(date).format("dddd, D MMMM YYYY");
};

export const formatDateTime = (date: string | Date): string => {
  return dayjs(date).format("dddd, D MMMM YYYY HH:mm:ss");
};

export const getCurrentDateTime = (): string => {
  return formatDateTime(new Date());
};

export const getFileTimestamp = (): string => {
  return new Date().toISOString().replace(/[:.]/g, "-");
};
