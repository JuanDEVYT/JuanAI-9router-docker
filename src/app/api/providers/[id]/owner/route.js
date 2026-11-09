import { NextResponse } from "next/server";
import { getProviderConnectionById, updateProviderConnection } from "@/models";
import { toProviderConnectionResponse } from "@/lib/providerConnectionResponse";
import { isCliTokenRequest } from "@/dashboardGuard.js";

// Mover la propiedad de una conexión entre el pool compartido/admin (tenantId NULL) y una
// cuenta concreta, o entre dos cuentas. A propósito es la ÚNICA ruta que puede saltarse el
// "tenantOwnsOrNull" de PUT /api/providers/[id] (que existe justo para que nadie pueda
// reclamar una conexión que no es suya): esta solo la usa el canal de token de CLI, que nunca
// lo expone un navegador, y del lado de JuanAI solo el panel de administración la llama.
export async function POST(request, { params }) {
  try {
    if (!(await isCliTokenRequest(request))) {
      return NextResponse.json({ error: "Esto requiere el token de CLI." }, { status: 403 });
    }
    const { id } = await params;
    const existing = await getProviderConnectionById(id);
    if (!existing) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const tenantId = body?.tenantId ? String(body.tenantId) : null;

    const updated = await updateProviderConnection(id, { tenantId });
    return NextResponse.json({ connection: toProviderConnectionResponse(updated) });
  } catch (error) {
    console.log("Error moving connection owner:", error);
    return NextResponse.json({ error: "No se pudo mover la conexión." }, { status: 500 });
  }
}
