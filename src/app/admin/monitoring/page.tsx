import { createServiceClient } from "@/lib/supabase/server";
import { formatDateTime, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Activity, MessageSquare, Cpu } from "lucide-react";
import type { ApiUsageLog, SystemError } from "@/types";

export default async function MonitoringPage() {
  const supabase = createServiceClient();

  const monthStart = new Date();
  monthStart.setDate(1);

  const [{ data: apiLogs }, { data: errors }, { data: whatsappLogs }] =
    await Promise.all([
      supabase
        .from("api_usage_logs")
        .select("*")
        .gte("created_at", monthStart.toISOString())
        .order("created_at", { ascending: false }),
      supabase
        .from("system_errors")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("api_usage_logs")
        .select("*")
        .eq("api_type", "whatsapp")
        .gte("created_at", monthStart.toISOString())
        .order("created_at", { ascending: false }),
    ]);

  // Aggregate API stats
  const claudeLogs = (apiLogs || []).filter((l: ApiUsageLog) => l.api_type === "claude");
  const whisperLogs = (apiLogs || []).filter((l: ApiUsageLog) => l.api_type === "whisper");
  const waCalls = (apiLogs || []).filter((l: ApiUsageLog) => l.api_type === "whatsapp");

  const totalClaudeTokens = claudeLogs.reduce(
    (s: number, l: ApiUsageLog) => s + (l.tokens_used || 0), 0
  );
  const totalClaudeCost = claudeLogs.reduce(
    (s: number, l: ApiUsageLog) => s + (Number(l.cost_estimate) || 0), 0
  );
  const totalWhisperCost = whisperLogs.reduce(
    (s: number, l: ApiUsageLog) => s + (Number(l.cost_estimate) || 0), 0
  );

  const severityColor: Record<string, string> = {
    low: "bg-gray-100 text-gray-700",
    medium: "bg-yellow-100 text-yellow-700",
    high: "bg-orange-100 text-orange-700",
    critical: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI ve Sistem İzleme</h1>
        <p className="text-sm text-gray-500 mt-1">Bu ay API kullanımı ve sistem hataları</p>
      </div>

      {/* API Usage Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            label: "Claude API Çağrıları",
            value: claudeLogs.length,
            sub: `${totalClaudeTokens.toLocaleString()} token`,
            icon: Cpu,
            color: "bg-purple-100 text-purple-600",
          },
          {
            label: "Claude Maliyet",
            value: formatCurrency(totalClaudeCost),
            sub: "Bu ay",
            icon: Activity,
            color: "bg-[#DCFCE7] text-[#16A34A]",
          },
          {
            label: "Whisper Transkripsiyon",
            value: whisperLogs.length,
            sub: formatCurrency(totalWhisperCost),
            icon: Activity,
            color: "bg-green-100 text-green-600",
          },
          {
            label: "WhatsApp Mesajları",
            value: waCalls.length,
            sub: "Bu ay",
            icon: MessageSquare,
            color: "bg-orange-100 text-orange-600",
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="pt-4 pb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Tabs defaultValue="errors">
        <TabsList>
          <TabsTrigger value="errors">
            Sistem Hataları ({errors?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="api">
            API Log ({apiLogs?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="whatsapp">
            WhatsApp Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="errors" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Önem</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Mesaj</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(errors || []).map((error: SystemError) => (
                      <tr key={error.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${severityColor[error.severity]}`}>
                            {error.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 line-clamp-2">{error.message}</p>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <p className="text-xs text-gray-500">{formatDateTime(error.created_at)}</p>
                        </td>
                      </tr>
                    ))}
                    {(!errors || errors.length === 0) && (
                      <tr>
                        <td colSpan={3} className="text-center py-8 text-sm text-gray-500">
                          ✓ Sistem hatası yok
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">API</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Token</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Maliyet</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Tarih</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(apiLogs || []).slice(0, 30).map((log: ApiUsageLog) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Badge variant={log.api_type === "claude" ? "default" : log.api_type === "whisper" ? "success" : "secondary"}>
                            {log.api_type.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {log.tokens_used?.toLocaleString() || "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {log.cost_estimate ? `₺${Number(log.cost_estimate).toFixed(4)}` : "—"}
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                          {formatDateTime(log.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">WhatsApp Mesaj Durumu</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{waCalls.length}</p>
                  <p className="text-xs text-gray-500">Gönderildi</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-500">0</p>
                  <p className="text-xs text-gray-500">Başarısız</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-600">
                    {formatCurrency(waCalls.reduce((s: number, l: ApiUsageLog) => s + Number(l.cost_estimate || 0), 0))}
                  </p>
                  <p className="text-xs text-gray-500">Bu Ay Maliyet</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
