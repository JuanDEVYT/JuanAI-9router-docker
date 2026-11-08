import { NextResponse } from "next/server";
import { getApiKeys, getApiKeyByTenantId, createApiKey } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import { isCliTokenRequest } from "@/dashboardGuard.js";

export const dynamic = "force-dynamic";

// GET /api/keys - List API keys
// GET /api/keys?tenantId=<id> - Look up the one key already issued for a tenant
// (CLI-token callers only — e.g. JuanAI Cloud checking whether an account
// already has a 9router key before minting a new one).
export async function GET(request) {
  try {
    const tenantId = request.nextUrl.searchParams.get("tenantId");
    if (tenantId) {
      if (!(await isCliTokenRequest(request))) {
        return NextResponse.json({ error: "tenantId lookup requires the CLI token" }, { status: 403 });
      }
      const key = await getApiKeyByTenantId(tenantId);
      return NextResponse.json({ key });
    }
    const keys = await getApiKeys();
    return NextResponse.json({ keys });
  } catch (error) {
    console.log("Error fetching keys:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}

// POST /api/keys - Create new API key
export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // `tenantId` tags the key to one JuanAI Cloud account so its traffic is
    // isolated from every other account's provider connections (see
    // src/sse/services/auth.js). Only a CLI-token-authenticated caller (i.e.
    // JuanAI's own backend, never the admin dashboard UI) may set it — this
    // is a server-to-server concept, not something an admin picks by hand.
    const tenantId = body.tenantId && (await isCliTokenRequest(request)) ? String(body.tenantId) : null;

    // Always get machineId from server
    const machineId = await getConsistentMachineId();
    const apiKey = await createApiKey(name, machineId, tenantId);

    return NextResponse.json({
      key: apiKey.key,
      name: apiKey.name,
      id: apiKey.id,
      machineId: apiKey.machineId,
      tenantId: apiKey.tenantId,
    }, { status: 201 });
  } catch (error) {
    console.log("Error creating key:", error);
    return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
  }
}
