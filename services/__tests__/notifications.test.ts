import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requestNotificationPermission, sendLocalNotification } from '../notifications';

describe('notifications service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when permission is denied', async () => {
    const NotificationMock = vi.fn(function NotificationCtor() {});
    Object.assign(NotificationMock, { permission: 'denied', requestPermission: vi.fn() });
    Object.defineProperty(window, 'Notification', { value: NotificationMock, configurable: true });

    const result = await requestNotificationPermission();

    expect(result).toBe(false);
  });

  it('returns true when permission is already granted', async () => {
    const requestPermission = vi.fn();
    const NotificationMock = vi.fn(function NotificationCtor() {});
    Object.assign(NotificationMock, { permission: 'granted', requestPermission });
    Object.defineProperty(window, 'Notification', { value: NotificationMock, configurable: true });

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('requests permission and returns true when granted', async () => {
    const requestPermission = vi.fn().mockResolvedValue('granted');
    const NotificationMock = vi.fn(function NotificationCtor() {});
    Object.assign(NotificationMock, { permission: 'default', requestPermission });
    Object.defineProperty(window, 'Notification', { value: NotificationMock, configurable: true });

    const result = await requestNotificationPermission();

    expect(result).toBe(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it('returns false when requesting permission throws', async () => {
    const requestPermission = vi.fn().mockRejectedValue(new Error('boom'));
    const NotificationMock = vi.fn(function NotificationCtor() {});
    Object.assign(NotificationMock, { permission: 'default', requestPermission });
    Object.defineProperty(window, 'Notification', { value: NotificationMock, configurable: true });

    const result = await requestNotificationPermission();

    expect(result).toBe(false);
  });

  it('does not create notification when permission is denied', () => {
    const NotificationMock = vi.fn(function NotificationCtor() {});
    Object.assign(NotificationMock, { permission: 'denied', requestPermission: vi.fn() });
    Object.defineProperty(window, 'Notification', { value: NotificationMock, configurable: true });

    sendLocalNotification('hello');

    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it('creates notification with default icon and custom options', () => {
    const NotificationMock = vi.fn(function NotificationCtor() {});
    Object.assign(NotificationMock, { permission: 'granted', requestPermission: vi.fn() });
    Object.defineProperty(window, 'Notification', { value: NotificationMock, configurable: true });

    sendLocalNotification('title', { body: 'body text' });

    expect(NotificationMock).toHaveBeenCalledTimes(1);
    const [title, options] = NotificationMock.mock.calls[0];
    expect(title).toBe('title');
    expect(options.body).toBe('body text');
    expect(options.icon).toContain('flaticon.com');
  });

  it('swallows errors when Notification constructor throws', () => {
    const NotificationMock = vi.fn(function NotificationCtor() {
      throw new Error('blocked');
    });
    Object.assign(NotificationMock, { permission: 'granted', requestPermission: vi.fn() });
    Object.defineProperty(window, 'Notification', { value: NotificationMock, configurable: true });

    expect(() => sendLocalNotification('x')).not.toThrow();
  });
});
