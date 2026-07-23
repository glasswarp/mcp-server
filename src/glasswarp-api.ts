/**
 * Minimal REST client for Platform API `/v1/*`.
 * Stateless — one client per MCP request, keyed by the caller's API key.
 */

// Production API gateway. Prefer GLASSWARP_API_BASE_URL in deploy env.
export const DEFAULT_API_BASE =
  process.env.GLASSWARP_API_BASE_URL?.replace(/\/$/, "") ||
  "https://signal.glasswarp.com";

export const CONSOLE_BASE =
  process.env.GLASSWARP_CONSOLE_URL?.replace(/\/$/, "") ||
  "https://www.glasswarp.com";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Rig = {
  id: string;
  machine_name?: string | null;
  status?: string;
  online?: boolean;
  api_access_enabled?: boolean;
};

export type Session = {
  session_id: string;
  host_id?: string;
  status?: string;
  mode?: string;
  created_at?: string;
  action_count?: number;
  billed_minutes?: number;
  capture_mode?: string;
};

export type GroundingTarget = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  role?: string;
  name?: string;
  source?: string;
  focused?: boolean;
  masked?: boolean;
  value?: string;
};

export type ObserveText = {
  window_title?: string;
  window_role?: string;
  targets?: string[];
  summary?: string;
};

export type ObservePayload = {
  jpeg_base64?: string;
  width: number;
  height: number;
  native_width: number;
  native_height: number;
  timestamp?: number;
  /** Null when dirty metadata is unavailable (GDI fallback) — assume changed. */
  dirty?: { rects?: number[][]; empty?: boolean; available?: boolean } | null;
  changed?: boolean;
  capture_mode?: string;
  targets?: GroundingTarget[];
  text?: ObserveText;
  marked?: boolean;
  timing?: {
    total_ms?: number;
    screenshot_rtt_ms?: number;
    dirty_rtt_ms?: number;
    targets_rtt_ms?: number;
    host_jpeg_ms?: number | null;
    host_uia_ms?: number | null;
    image?: boolean;
  };
};

export type InputEvent = Record<string, unknown>;

export class GlasswarpApi {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string = DEFAULT_API_BASE,
  ) {}

  private async request<T>(
    method: string,
    path: string,
    opts?: { query?: Record<string, string | number | undefined>; body?: unknown },
  ): Promise<T> {
    const url = new URL(path, `${this.baseUrl}/`);
    if (opts?.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        ...(opts?.body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const err =
        (json as { error?: string } | null)?.error ||
        text ||
        res.statusText ||
        "request failed";
      throw new ApiError(res.status, err);
    }
    return json as T;
  }

  listRigs(): Promise<{ rigs: Rig[] }> {
    return this.request("GET", "/v1/rigs");
  }

  createSession(rigId: string): Promise<Session> {
    return this.request("POST", "/v1/sessions", {
      body: { rig_id: rigId, mode: "desktop" },
    });
  }

  getSession(sessionId: string): Promise<Session> {
    return this.request("GET", `/v1/sessions/${sessionId}`);
  }

  listSessions(): Promise<{ sessions: Session[] }> {
    return this.request("GET", "/v1/sessions");
  }

  endSession(sessionId: string): Promise<unknown> {
    return this.request("DELETE", `/v1/sessions/${sessionId}`);
  }

  observe(
    sessionId: string,
    opts?: { maxWidth?: number; mark?: boolean; image?: boolean; quality?: number },
  ): Promise<ObservePayload> {
    const wantImage = opts?.image !== false;
    return this.request("GET", `/v1/sessions/${sessionId}/observe`, {
      query: {
        max_width: opts?.maxWidth ?? (wantImage ? 1280 : undefined),
        quality: opts?.quality,
        mark: wantImage && opts?.mark !== false ? 1 : 0,
        image: wantImage ? 1 : 0,
      },
    });
  }

  listTargets(sessionId: string): Promise<{ targets: GroundingTarget[] }> {
    return this.request("GET", `/v1/sessions/${sessionId}/targets`);
  }

  sendInput(sessionId: string, events: InputEvent[]): Promise<{ ok?: boolean }> {
    return this.request("POST", `/v1/sessions/${sessionId}/input`, {
      body: { events },
    });
  }

  launchApp(
    sessionId: string,
    path: string,
    args: string[] = [],
  ): Promise<{ ok?: boolean; pid?: number }> {
    return this.request("POST", `/v1/sessions/${sessionId}/app/launch`, {
      body: { path, args },
    });
  }
}

export function noEligibleRigMessage(): string {
  return [
    "No online, API-enabled rig found for this API key.",
    "The machine owner must: (1) install the Windows host from https://www.glasswarp.com/downloads,",
    "(2) pair at https://www.glasswarp.com/pair,",
    "(3) enable API access on the rig in the console.",
    "This is an owner-consent step — do not ask for Windows passwords.",
  ].join(" ");
}

export function liveViewConsoleUrl(sessionId: string): string {
  return `${CONSOLE_BASE}/console/sessions?session=${encodeURIComponent(sessionId)}`;
}
