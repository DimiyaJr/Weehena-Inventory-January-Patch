// src/utils/timeUtils.ts

export const isOffHoursSriLanka = (): boolean => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Colombo'
  };

  const sLankaTime = new Intl.DateTimeFormat('en-US', options).format(now);
  const [hourStr, minuteStr] = sLankaTime.split(':');
  const currentHour = parseInt(hourStr, 10);
  const currentMinute = parseInt(minuteStr, 10);

  // Off-hours are 6:00 PM (18:00) to 9:00 AM (9:00)
  // This means from 18:00:00 to 23:59:59 (inclusive)
  // AND from 00:00:00 to 08:59:59 (inclusive)
  const isAfter6PM = currentHour >= 18;
  const isBefore9AM = currentHour < 9;

  return isAfter6PM || isBefore9AM;
};
