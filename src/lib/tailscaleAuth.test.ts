import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTailscaleAutoLoginSuppression,
  isTailscaleSessionResponse,
  requestTailscaleSession,
  resetTailscaleAutoLoginState,
  suppressTailscaleAutoLogin,
  tryTailscaleAutoLogin,
  tryTailscaleAutoLoginOnce,
  type TailscaleAuthConfig,
} from "./tailscaleAuth";

const CONFIG: TailscaleAuthConfig = {
  authUrl: "https://bridge.tailnet.ts.net/session",
  origin: "https://larsenevans-wpbox-prod.vercel.app",
  timeoutMs: 2500,
};

describe("tailscale auth", () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearTailscaleAutoLoginSuppression();
    resetTailscaleAutoLoginState();
  });

  it("validates bridge payload shape", () => {
    expect(isTailscaleSessionResponse({
      ok: true,
      session: { access_token: "access", refresh_token: "refresh" },
    })).toBe(true);

    expect(isTailscaleSessionResponse({
      ok: true,
      session: { access_token: "access" },
    })).toBe(false);
  });

  it("returns null when auto-login is suppressed", async () => {
    suppressTailscaleAutoLogin();

    const fetchMock = vi.fn<typeof fetch>();
    const session = await requestTailscaleSession(CONFIG, fetchMock);

    expect(session).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns session tokens from the bridge", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token",
        },
      }),
    } as Response);

    const session = await requestTailscaleSession(CONFIG, fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(session).toEqual({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
  });

  it("sets the Supabase session on successful auto-login", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token",
        },
      }),
    } as Response);

    const setSession = vi.fn().mockResolvedValue({ error: null });
    const success = await tryTailscaleAutoLogin(
      { auth: { setSession } },
      CONFIG,
      fetchMock,
    );

    expect(success).toBe(true);
    expect(setSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(sessionStorage.getItem("wpbox.tailscale.manual-signout")).toBeNull();
  });

  it("reuses the in-flight auto-login attempt", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        session: {
          access_token: "access-token",
          refresh_token: "refresh-token",
        },
      }),
    } as Response);

    const setSession = vi.fn().mockResolvedValue({ error: null });

    const [first, second] = await Promise.all([
      tryTailscaleAutoLoginOnce({ auth: { setSession } }, CONFIG, fetchMock),
      tryTailscaleAutoLoginOnce({ auth: { setSession } }, CONFIG, fetchMock),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(setSession).toHaveBeenCalledTimes(1);
  });

  it("allows a later retry after the shared attempt settles", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          session: {
            access_token: "access-token",
            refresh_token: "refresh-token",
          },
        }),
      } as Response);

    const setSession = vi.fn().mockResolvedValue({ error: null });

    const first = await tryTailscaleAutoLoginOnce({ auth: { setSession } }, CONFIG, fetchMock);
    const second = await tryTailscaleAutoLoginOnce({ auth: { setSession } }, CONFIG, fetchMock);

    expect(first).toBe(false);
    expect(second).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(setSession).toHaveBeenCalledTimes(1);
  });
});
