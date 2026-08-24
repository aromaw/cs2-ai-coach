// V2 六维雷达（player.md §1 右 5 列）：裸放板面，无卡片。
// 玩家 = volt 描边 + 淡填充；全队平均 = ink-3 虚线无填充。动效：整体淡入 + 描边 draw。
import { motion } from "framer-motion";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { PlayerStat } from "@contracts/analysis";
import { radarScores, teamRadarAvg } from "./utils";

interface RadarPanelProps {
  player: PlayerStat;
  players: PlayerStat[];
}

export default function RadarPanel({ player, players }: RadarPanelProps) {
  const scores = radarScores(player);
  const teamAvg = teamRadarAvg(players, player.teamName);
  const team = players.filter((p) => p.teamName === player.teamName);

  const data = scores.map((s, i) => {
    const rank =
      team
        .map((p) => radarScores(p)[i].value)
        .sort((a, b) => b - a)
        .indexOf(s.value) + 1;
    return { axis: s.label, short: s.short, player: s.value, team: teamAvg[i], rank };
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex h-full flex-col"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">
        六维画像 Profile
      </p>
      <div className="mt-2 min-h-[320px] flex-1">
        <ResponsiveContainer width="100%" height={320}>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke="#222C37" />
            <PolarAngleAxis
              dataKey="axis"
              tick={{ fill: "#98A5AF", fontSize: 10, fontFamily: "JetBrains Mono" }}
            />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="全队平均"
              dataKey="team"
              stroke="#5B6873"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              fill="transparent"
              isAnimationActive={false}
            />
            <Radar
              name={player.name}
              dataKey="player"
              stroke="#C8FF3D"
              strokeWidth={2}
              fill="#C8FF3D"
              fillOpacity={0.14}
              isAnimationActive
              animationDuration={1000}
              animationBegin={200}
            />
            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div className="rounded-sm border border-line bg-board-3 px-3 py-2 font-mono text-xs text-ink-1">
                    <p>
                      {d.short} <span className="text-volt">{d.player}</span>
                      <span className="text-ink-3"> · 队内 #{d.rank}</span>
                    </p>
                    <p className="mt-1 text-ink-3">全队平均 {d.team}</p>
                  </div>
                );
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center gap-5 text-xs">
        <span className="flex items-center gap-1.5 text-ink-2">
          <span className="h-2 w-2 rounded-full bg-volt" /> {player.name}
        </span>
        <span className="flex items-center gap-1.5 text-ink-3">
          <span className="h-0.5 w-4 border-t border-dashed border-ink-3" /> 全队平均
        </span>
      </div>
    </motion.div>
  );
}
