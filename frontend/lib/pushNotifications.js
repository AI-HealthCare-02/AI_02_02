import { api } from '../hooks/useApi';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

function isPushSupported() {
  return (
    typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window
  );
}

async function getRegistrationIfAny() {
  if (!isPushSupported()) {
    return null;
  }
  return navigator.serviceWorker.getRegistration('/').catch(() => null);
}

async function getPublicKey() {
  const response = await api('/api/v1/push/public-key');
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.enabled || !data.public_key) {
    throw new Error('브라우저 알림 서버 설정이 아직 완료되지 않았어요.');
  }
  return data.public_key;
}

export async function enablePushNotifications() {
  if (!isPushSupported()) {
    throw new Error('이 브라우저는 백그라운드 알림을 지원하지 않아요.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('브라우저 알림 권한이 허용되지 않았어요.');
  }

  const publicKey = await getPublicKey();
  const registration = await navigator.serviceWorker.register('/sw.js');
  await registration.update().catch(() => undefined);
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const response = await api('/api/v1/push/subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription.toJSON()),
  });
  if (!response.ok) {
    throw new Error('브라우저 알림 등록에 실패했어요.');
  }
  return true;
}

export async function disablePushNotifications() {
  if (!isPushSupported()) {
    return false;
  }
  const registration = await getRegistrationIfAny();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await api('/api/v1/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify(subscription.toJSON()),
    }).catch(() => undefined);
    await subscription.unsubscribe().catch(() => undefined);
  }
  await api('/api/v1/push/preferences', {
    method: 'POST',
    body: JSON.stringify({ action: 'disable' }),
  }).catch(() => undefined);
  return true;
}

export async function getPushSubscriptionState() {
  if (!isPushSupported()) {
    return { supported: false, configured: false, permission: 'unsupported', subscribed: false };
  }
  const permission = Notification.permission;
  const registration = await getRegistrationIfAny();
  const subscription = await registration?.pushManager.getSubscription();
  let configured = true;
  let serverSubscribed = Boolean(subscription);

  try {
    const response = await api('/api/v1/push/subscriptions/status');
    const data = await response.json().catch(() => ({}));
    if (response.ok) {
      configured = Boolean(data?.configured);
      serverSubscribed = configured && Boolean(data?.subscribed);
    }
  } catch {
    // Keep local browser state as the fallback.
  }

  return {
    supported: true,
    configured,
    permission,
    subscribed: Boolean(subscription) && serverSubscribed,
  };
}

export function getPushPermission() {
  if (!isPushSupported()) {
    return 'unsupported';
  }
  return Notification.permission;
}
