import type { WgTunnelStats } from "./wgstats";

export interface ReportPayload {
  title: string;
  description?: string;
  includeLogs: boolean;
}

export interface ReportResult {
  ok: boolean;
  issueUrl?: string;
  issueNumber?: number;
  error?: string;
  blocked?: boolean;
  retryAfter?: number;
}

export async function submitBugReport(
  payload: ReportPayload,
  _ctx: {
    statusBypass: string;
    installsFlavours?: string;
    graphics?: string;
    wgTunel?: WgTunnelStats;
  },
): Promise<ReportResult> {
  void payload;
  void _ctx;
  return {
    ok: false,
    error: "Este app não manda relato pra fora. Usa Copiar diagnóstico e envia no Discord se quiser.",
  };
}
