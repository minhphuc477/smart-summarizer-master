import { generateCalendarLinks } from '../calendarLinks';

describe('Calendar Links Module', () => {
  const mockEvent = {
    task: 'Team Meeting',
    datetime: '2025-10-27T14:00:00Z',
    description: 'Discuss project updates'
  };

  test('generates all calendar links', () => {
    const links = generateCalendarLinks(mockEvent);
    expect(links.google).toContain('google.com/calendar');
    expect(links.outlook).toContain('outlook.live.com');
    expect(links.office365).toContain('outlook.office.com');
    expect(links.yahoo).toContain('calendar.yahoo.com');
  });

  test('encodes event details correctly', () => {
    const links = generateCalendarLinks(mockEvent);
    expect(links.google).toContain('Team');
    expect(links.outlook).toContain('subject=');
  });

  test('handles events without description', () => {
    const event = { task: 'Meeting', datetime: '2025-10-27T14:00:00Z' };
    const links = generateCalendarLinks(event);
    expect(links.google).toBeDefined();
    expect(links.outlook).toBeDefined();
  });

  test('formats datetime for different services', () => {
    const links = generateCalendarLinks(mockEvent);
    expect(links.google).toMatch(/dates=\d{8}T\d{6}/);
    expect(links.outlook).toContain('startdt=');
  });
});
