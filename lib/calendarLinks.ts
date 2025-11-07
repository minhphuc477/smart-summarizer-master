// Utility functions for generating calendar links

export type CalendarProvider = 'google' | 'outlook' | 'office365' | 'yahoo' | 'ics';

export type CalendarLinkOptions = {
  task: string;
  datetime: string; // ISO 8601 format
  duration?: number; // in minutes, default 60
  description?: string;
};

/**
 * Generate calendar links for various providers
 */
export function generateCalendarLinks(options: CalendarLinkOptions) {
  const { task, datetime, duration = 60, description = '' } = options;
  
  const startTime = new Date(datetime);
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  return {
    google: generateGoogleCalendarLink(task, startTime, endTime, description),
    outlook: generateOutlookLink(task, startTime, endTime, description),
    office365: generateOffice365Link(task, startTime, endTime, description),
    yahoo: generateYahooLink(task, startTime, endTime, description),
    ics: generateICSFile(task, startTime, endTime, description),
  };
}

/**
 * Format date for Google Calendar (YYYYMMDDTHHMMSSZ)
 */
function formatDateForGoogle(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d\d\d/g, '');
}

/**
 * Generate Google Calendar link
 */
function generateGoogleCalendarLink(
  title: string,
  startTime: Date,
  endTime: Date,
  description: string
): string {
  const url = new URL('https://www.google.com/calendar/render');
  url.searchParams.append('action', 'TEMPLATE');
  url.searchParams.append('text', title);
  url.searchParams.append('dates', `${formatDateForGoogle(startTime)}/${formatDateForGoogle(endTime)}`);
  if (description) {
    url.searchParams.append('details', description);
  }
  return url.toString();
}

/**
 * Generate Outlook.com link
 */
function generateOutlookLink(
  title: string,
  startTime: Date,
  endTime: Date,
  description: string
): string {
  const url = new URL('https://outlook.live.com/calendar/0/deeplink/compose');
  url.searchParams.append('subject', title);
  url.searchParams.append('startdt', startTime.toISOString());
  url.searchParams.append('enddt', endTime.toISOString());
  if (description) {
    url.searchParams.append('body', description);
  }
  url.searchParams.append('path', '/calendar/action/compose');
  url.searchParams.append('rru', 'addevent');
  return url.toString();
}

/**
 * Generate Office 365 link
 */
function generateOffice365Link(
  title: string,
  startTime: Date,
  endTime: Date,
  description: string
): string {
  const url = new URL('https://outlook.office.com/calendar/0/deeplink/compose');
  url.searchParams.append('subject', title);
  url.searchParams.append('startdt', startTime.toISOString());
  url.searchParams.append('enddt', endTime.toISOString());
  if (description) {
    url.searchParams.append('body', description);
  }
  url.searchParams.append('path', '/calendar/action/compose');
  url.searchParams.append('rru', 'addevent');
  return url.toString();
}

/**
 * Generate Yahoo Calendar link
 */
function generateYahooLink(
  title: string,
  startTime: Date,
  endTime: Date,
  description: string
): string {
  const url = new URL('https://calendar.yahoo.com/');
  url.searchParams.append('v', '60');
  url.searchParams.append('title', title);
  url.searchParams.append('st', formatDateForGoogle(startTime));
  url.searchParams.append('et', formatDateForGoogle(endTime));
  if (description) {
    url.searchParams.append('desc', description);
  }
  return url.toString();
}

/**
 * Generate ICS file content
 */
function generateICSFile(
  title: string,
  startTime: Date,
  endTime: Date,
  description: string
): string {
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Smart Summarizer//Calendar Event//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatDateForGoogle(startTime)}`,
    `DTEND:${formatDateForGoogle(endTime)}`,
    `SUMMARY:${title}`,
    description ? `DESCRIPTION:${description.replace(/\n/g, '\\n')}` : '',
    `DTSTAMP:${formatDateForGoogle(new Date())}`,
    `UID:${Date.now()}@smart-summarizer.app`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');

  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsContent)}`;
}

/**
 * Download ICS file
 */
export function downloadICS(task: string, datetime: string, duration = 60, description = '') {
  const links = generateCalendarLinks({ task, datetime, duration, description });
  const link = document.createElement('a');
  link.href = links.ics;
  link.download = `${task.replace(/[^a-z0-9]/gi, '_')}.ics`;
  link.click();
}
