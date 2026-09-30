type DeviceSyncResult = {
  attempted: boolean;
  synced?: boolean;
  queued?: boolean;
  method?: "direct" | "queue" | "none";
  pending?: boolean;
};

function localSyncUrl(): URL | null {
  const configured = process.env.GYM_SYNC_SERVER_URL?.trim();
  const token = process.env.GYM_SYNC_API_TOKEN?.trim();
  const deviceId = process.env.DEFAULT_ZK_DEVICE_SN?.trim();
  if (!configured || !token || !deviceId) return null;

  try {
    const url = new URL(configured);
    if (url.protocol !== "http:" ||
        !["127.0.0.1", "localhost", "[::1]", "sync"].includes(url.hostname) ||
        url.username || url.password || url.search || url.hash) return null;
    url.pathname = "/api/device-users/reconcile";
    return url;
  } catch {
    return null;
  }
}

export async function reconcileLocalCustomerOnClock(customerId: string): Promise<DeviceSyncResult> {
  const url = localSyncUrl();
  const token = process.env.GYM_SYNC_API_TOKEN?.trim();
  const deviceId = process.env.DEFAULT_ZK_DEVICE_SN?.trim();
  if (!url || !token || !deviceId) return { attempted: false, pending: true };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ customer_id: customerId, device_id: deviceId }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const result = await response.json().catch(() => null) as {
      success?: boolean;
      queued_commands?: number;
    } | null;
    const success = response.ok && result?.success === true;
    return {
      attempted: true,
      synced: success,
      queued: success && Number(result?.queued_commands) > 0,
      method: success && Number(result?.queued_commands) > 0 ? "queue" : "none",
    };
  } catch {
    return { attempted: true, synced: false, queued: false, method: "none" };
  }
}
