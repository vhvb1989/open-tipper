import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock auth
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => mockAuth(),
}));

// Mock crypto
vi.mock("crypto", () => ({
  default: {
    randomBytes: () => ({
      toString: () => "new-random-invite-code-24",
    }),
  },
}));

// Mock prisma
const mockPrisma = {
  membership: { findUnique: vi.fn() },
  group: { update: vi.fn() },
};
vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

describe("Invite Link API — POST /api/groups/:id/invite-link", () => {
  const routeParams = { params: Promise.resolve({ id: "group-1" }) };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const { POST } = await import("@/app/api/groups/[id]/invite-link/route");

    const req = new NextRequest("http://localhost:3000/api/groups/group-1/invite-link", {
      method: "POST",
    });
    const res = await POST(req, routeParams);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not a member", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/groups/[id]/invite-link/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/invite-link", {
      method: "POST",
    });
    const res = await POST(req, routeParams);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Not a member");
  });

  it("returns 403 when user is a member but not admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({
      userId: "user-1",
      groupId: "group-1",
      role: "MEMBER",
    });

    const { POST } = await import("@/app/api/groups/[id]/invite-link/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/invite-link", {
      method: "POST",
    });
    const res = await POST(req, routeParams);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Only admins");
  });

  it("regenerates invite code when user is admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockPrisma.membership.findUnique.mockResolvedValue({
      userId: "user-1",
      groupId: "group-1",
      role: "ADMIN",
    });
    mockPrisma.group.update.mockResolvedValue({
      inviteCode: "new-random-invite-code-24",
    });

    const { POST } = await import("@/app/api/groups/[id]/invite-link/route");
    const req = new NextRequest("http://localhost:3000/api/groups/group-1/invite-link", {
      method: "POST",
    });
    const res = await POST(req, routeParams);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.inviteCode).toBe("new-random-invite-code-24");

    // Verify prisma.group.update was called with the correct params
    expect(mockPrisma.group.update).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { inviteCode: "new-random-invite-code-24" },
      select: { inviteCode: true },
    });
  });

  it("calls membership.findUnique with correct composite key", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-42" } });
    mockPrisma.membership.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/groups/[id]/invite-link/route");
    const params = { params: Promise.resolve({ id: "group-99" }) };
    const req = new NextRequest("http://localhost:3000/api/groups/group-99/invite-link", {
      method: "POST",
    });
    await POST(req, params);

    expect(mockPrisma.membership.findUnique).toHaveBeenCalledWith({
      where: { userId_groupId: { userId: "user-42", groupId: "group-99" } },
    });
  });
});
