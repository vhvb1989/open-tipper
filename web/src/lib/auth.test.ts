import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the modules before importing
vi.mock("next-auth", () => {
  const mockNextAuth = vi.fn().mockReturnValue({
    handlers: { GET: vi.fn(), POST: vi.fn() },
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  });
  return { default: mockNextAuth };
});

vi.mock("@auth/prisma-adapter", () => ({
  PrismaAdapter: vi.fn().mockReturnValue({}),
}));

vi.mock("next-auth/providers/google", () => ({
  default: vi.fn((config) => ({ id: "google", ...config })),
}));

vi.mock("next-auth/providers/github", () => ({
  default: vi.fn((config) => ({ id: "github", ...config })),
}));

vi.mock("next-auth/providers/microsoft-entra-id", () => ({
  default: vi.fn((config) => ({ id: "microsoft-entra-id", ...config })),
}));

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

describe("Auth configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear all auth env vars
    delete process.env.AUTH_GOOGLE_ID;
    delete process.env.AUTH_GOOGLE_SECRET;
    delete process.env.AUTH_GITHUB_ID;
    delete process.env.AUTH_GITHUB_SECRET;
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
    delete process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID;
  });

  it("exports auth, signIn, signOut, and handlers", async () => {
    const authModule = await import("./auth");
    expect(authModule.auth).toBeDefined();
    expect(authModule.signIn).toBeDefined();
    expect(authModule.signOut).toBeDefined();
    expect(authModule.handlers).toBeDefined();
  });

  it("initializes NextAuth with PrismaAdapter", async () => {
    const { PrismaAdapter } = await import("@auth/prisma-adapter");
    await import("./auth");

    expect(PrismaAdapter).toHaveBeenCalled();
  });

  it("configures custom sign-in page", async () => {
    const NextAuth = (await import("next-auth")).default;
    await import("./auth");

    const config = (NextAuth as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(config.pages.signIn).toBe("/signin");
  });
});
