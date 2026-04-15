"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface TurkeyMapProps {
  cityData: Record<string, number>;
}

export default function TurkeyMap({ cityData }: TurkeyMapProps) {
  const maxCount = Math.max(...Object.values(cityData), 1);
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const router = useRouter();

  const getColor = (city: string) => {
    const count = cityData[city] || 0;
    if (count === 0) return "#e5e7eb"; // grey — no vets
    const intensity = count / maxCount;
    if (intensity < 0.2) return "#dcfce7"; // very light green
    if (intensity < 0.4) return "#86efac"; // light green
    if (intensity < 0.65) return "#22c55e"; // medium green
    if (intensity < 0.85) return "#16a34a"; // dark green
    return "#166534"; // darkest green
  };

  const cities = [
    { name: "İstanbul", x: 120, y: 60 },
    { name: "Ankara", x: 220, y: 110 },
    { name: "İzmir", x: 80, y: 140 },
    { name: "Bursa", x: 145, y: 90 },
    { name: "Antalya", x: 180, y: 200 },
    { name: "Konya", x: 220, y: 170 },
    { name: "Adana", x: 270, y: 200 },
    { name: "Gaziantep", x: 310, y: 210 },
    { name: "Şanlıurfa", x: 340, y: 200 },
    { name: "Diyarbakır", x: 370, y: 185 },
    { name: "Mersin", x: 255, y: 210 },
    { name: "Kayseri", x: 275, y: 150 },
    { name: "Samsun", x: 290, y: 80 },
    { name: "Trabzon", x: 340, y: 70 },
    { name: "Erzurum", x: 380, y: 110 },
    { name: "Van", x: 420, y: 165 },
    { name: "Malatya", x: 330, y: 160 },
  ];

  return (
    <div className="relative">
      <svg
        viewBox="0 0 500 280"
        className="w-full h-auto cursor-pointer"
        style={{ maxHeight: "180px" }}
      >
        <path
          d="M60,90 L120,50 L170,45 L220,55 L270,50 L320,60 L370,55 L430,70 L470,80 L480,100 L470,130 L450,160 L420,180 L390,200 L350,215 L300,220 L250,225 L200,220 L160,215 L130,210 L100,195 L75,170 L60,140 L50,110 Z"
          fill="#f9fafb"
          stroke="#d1d5db"
          strokeWidth="1.5"
        />

        {cities.map((city) => {
          const count = cityData[city.name] || 0;
          const color = getColor(city.name);
          const radius = count > 0 ? Math.max(7, Math.min(15, 5 + count * 2)) : 5;
          const isHovered = hoveredCity === city.name;

          return (
            <g
              key={city.name}
              className="cursor-pointer"
              onClick={() => router.push(`/admin/vets?city=${encodeURIComponent(city.name)}`)}
              onMouseEnter={(e) => {
                setHoveredCity(city.name);
                const svg = (e.target as SVGElement).closest("svg");
                if (svg) {
                  const rect = svg.getBoundingClientRect();
                  const svgW = 500; const svgH = 280;
                  const px = (city.x / svgW) * rect.width;
                  const py = (city.y / svgH) * rect.height;
                  setTooltipPos({ x: px, y: py });
                }
              }}
              onMouseLeave={() => setHoveredCity(null)}
            >
              <circle
                cx={city.x}
                cy={city.y}
                r={isHovered ? radius + 2 : radius}
                fill={color}
                stroke={count > 0 ? "#166534" : "#9ca3af"}
                strokeWidth={isHovered ? "2" : "1"}
                className="transition-all duration-150"
              />
              {count > 0 && (
                <text
                  x={city.x}
                  y={city.y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="7"
                  fill="white"
                  fontWeight="bold"
                  style={{ pointerEvents: "none" }}
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoveredCity && (
        <div
          className="absolute bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 pointer-events-none z-10 whitespace-nowrap shadow-lg"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 40}px`,
            transform: "translateX(-50%)",
          }}
        >
          <p className="font-semibold">{hoveredCity}</p>
          <p className="text-gray-300">{cityData[hoveredCity] || 0} veteriner</p>
          <p className="text-gray-400 text-[10px]">Tıkla → filtrele</p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 justify-center">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#e5e7eb] border border-gray-300" />
          <span className="text-xs text-gray-500">Yok</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#86efac] border border-[#166534]" />
          <span className="text-xs text-gray-500">Az</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full bg-[#166534] border border-[#166534]" />
          <span className="text-xs text-gray-500">Çok</span>
        </div>
      </div>
    </div>
  );
}
