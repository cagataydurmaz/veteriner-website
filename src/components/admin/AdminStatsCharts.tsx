"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart2 } from "lucide-react";

interface AppointmentPoint {
  date: string;
  randevu: number;
}

interface RegistrationPoint {
  date: string;
  kullanici: number;
  veteriner: number;
}

interface AdminStatsChartsProps {
  appointmentData: AppointmentPoint[];
  registrationData: RegistrationPoint[];
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-[220px] gap-3 text-gray-400">
      <BarChart2 className="w-10 h-10 opacity-30" />
      <p className="text-sm font-medium">Henüz yeterli veri bulunmuyor</p>
    </div>
  );
}

export default function AdminStatsCharts({
  appointmentData,
  registrationData,
}: AdminStatsChartsProps) {
  const hasAppointmentData = appointmentData.some((d) => d.randevu > 0);
  const hasRegistrationData = registrationData.some(
    (d) => d.kullanici > 0 || d.veteriner > 0
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Platform İstatistikleri</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="appointments">
          <TabsList className="w-full">
            <TabsTrigger value="appointments" className="flex-1">
              Randevular
            </TabsTrigger>
            <TabsTrigger value="registrations" className="flex-1">
              Kayıtlar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="appointments" className="mt-4">
            {hasAppointmentData ? (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  Son 30 gün — günlük randevu sayısı
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={appointmentData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                      formatter={(v) => [`${v} randevu`, "Adet"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="randevu"
                      stroke="#166534"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </>
            ) : (
              <EmptyState />
            )}
          </TabsContent>

          <TabsContent value="registrations" className="mt-4">
            {hasRegistrationData ? (
              <>
                <p className="text-xs text-gray-500 mb-3">
                  Son 30 gün — yeni kayıtlar
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={registrationData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                    <Legend />
                    <Bar
                      dataKey="kullanici"
                      name="Kullanıcılar"
                      fill="#166534"
                      radius={[3, 3, 0, 0]}
                    />
                    <Bar
                      dataKey="veteriner"
                      name="Veterinerler"
                      fill="#16A34A"
                      radius={[3, 3, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </>
            ) : (
              <EmptyState />
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
