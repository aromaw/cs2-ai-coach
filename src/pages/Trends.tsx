// 近期趋势页 /trends：最近 5 场比赛的个人指标走势、风格变化、瓶颈与保持/改变清单。
import { useState } from "react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import SectionHeader from "@/components/board/SectionHeader";
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

const ROWS: { key: string; label: string; digits: number }[] = [
  { key: "adr", label: "ADR", digits: 1 },
  { key: "rating", label: "Rating", digits: 2 },
  { key: "kast", label: "KAST%", digits: 1 },
  { key: "hsPercent", label: "爆头率%", digits: 1 },
  { key: "openingDuelWinRate", label: "首杀胜率%", digits: 1 },
  { key: "kd", label: "K/D", digits: 2 },
  { key: "firstKills", label: "首杀", digits: 0 },
  { key: "tradeKills", label: "补枪", digits: 0 },
  { key: "flashAssists", label: "闪光助攻", digits: 0 },
  { key: "utilityDamage", label: "道具伤害", digits: 0 },
  { key: "postPlantSurvivalRate", label: "下包后存活%", digits: 0 },
];

const TREND_ICON = { up: "▲", down: "▼", flat: "—" } as const;
const TREND_CLS = {
  up: "text-success",
  down: "text-danger",
  flat: "text-ink-3",
} as const;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Trends() {
  const rosterQ = trpc.trends.roster.useQuery(undefined, { retry: 1 });
  const roster = rosterQ.data ?? [];
  const [picked, setPicked] = useState<string>(
    () => localStorage.getItem("retake:trend-player") ?? "",
  );
  const steamid = picked || roster[0]?.steamid || "";
  const trendQ = trpc.trends.player.useQuery(
    { steamid },
    { enabled: !!steamid, retry: 0 },
  );
  const trend = trendQ.data;
  const notFound = trendQ.isError;

  const select = (id: string) => {
    setPicked(id);
    localStorage.setItem("retake:trend-player", id);
  };

  const directionOf = (metric: string) =>
    trend?.directions.find((d) => d.metric === metric);

  return (
    <div className="mx-auto max-w-[1360px] px-6 py-10 md:px-10">
      {/* 页头 */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] tracking-[0.3em] text-ink-3">
            RECENT FORM
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink-1">
            近期趋势<span className="text-volt">.</span>
          </h1>
          <p className="mt-2 max-w-lg text-sm text-ink-2">
            基于本地存储的最近 {trend?.matches.length ?? 5} 场比赛，追踪风格变化、
            瓶颈所在，以及哪些该改、哪些该保持。
          </p>
        </div>
        <label className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
            分析对象
          </span>
          <select
            value={steamid}
            onChange={(e) => select(e.target.value)}
            className="max-w-[200px] rounded-sm border border-line bg-board-3 px-2 py-1 font-mono text-xs text-ink-1 outline-none transition-colors duration-200 hover:border-line-strong"
          >
            {roster.map((r) => (
              <option key={r.steamid} value={r.steamid}>
                {r.name}（{r.matchCount} 场）
              </option>
            ))}
          </select>
        </label>
      </div>

      {rosterQ.isLoading && (
        <div className="mt-10 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-sm bg-board-2" />
          ))}
        </div>
      )}

      {!rosterQ.isLoading && roster.length === 0 && (
        <p className="mt-10 border border-line px-4 py-6 text-sm text-ink-2">
          还没有任何比赛记录。先
          <Link to="/" className="mx-1 text-volt underline underline-offset-4">
            上传一场 demo
          </Link>
          ，积累至少两场后就能看趋势。
        </p>
      )}

      {notFound && (
        <p className="mt-10 border border-line px-4 py-6 text-sm text-ink-2">
          「{roster.find((r) => r.steamid === steamid)?.name ?? "该玩家"}」目前只有
          一场比赛记录。趋势需要至少两场——继续上传最近的 demo
          （建议直接传完美平台下载的 zip），凑够样本后这里会自动出现走势分析。
        </p>
      )}

      {trend && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {/* S1 逐场指标表 */}
          <section className="mt-10 border-t border-line py-8">
            <SectionHeader
              title="逐场指标"
              en="MATCH BY MATCH"
              note={`${trend.playerName} · 时间从早到晚`}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] uppercase tracking-[0.18em] text-ink-3">
                    <th className="py-2 pr-4 font-normal">指标</th>
                    {trend.matches.map((m) => (
                      <th key={m.matchId} className="py-2 pr-4 text-right font-normal">
                        <Link
                          to={`/match/${m.matchId}`}
                          className="text-ink-3 transition-colors hover:text-volt"
                        >
                          {fmtDate(m.playedAt)} {m.map} {m.scoreT}:{m.scoreCT}
                        </Link>
                      </th>
                    ))}
                    <th className="py-2 text-right font-normal">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => {
                    const dir = directionOf(row.key);
                    return (
                      <tr
                        key={row.key}
                        className="border-b border-line/50 text-ink-2"
                      >
                        <td className="py-2 pr-4 text-ink-1">{row.label}</td>
                        {trend.matches.map((m) => {
                          const v = (m as unknown as Record<string, number | null>)[
                            row.key
                          ];
                          return (
                            <td
                              key={m.matchId}
                              className="py-2 pr-4 text-right tabular-nums"
                            >
                              {v === null || v === undefined
                                ? "—"
                                : Number(v).toFixed(row.digits)}
                            </td>
                          );
                        })}
                        <td
                          className={cn(
                            "py-2 text-right tabular-nums",
                            dir && TREND_CLS[dir.trend],
                          )}
                        >
                          {dir
                            ? `${dir.delta > 0 ? "+" : ""}${dir.delta}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* S2 走势方向 */}
          <section className="border-t border-line py-8">
            <SectionHeader title="风格走向" en="DIRECTION" />
            <ul className="mt-4 divide-y divide-line/50">
              {trend.directions.map((d) => (
                <li
                  key={d.metric}
                  className="flex items-baseline gap-3 py-2.5 text-sm"
                >
                  <span
                    className={cn(
                      "w-4 shrink-0 font-mono text-[10px]",
                      TREND_CLS[d.trend],
                    )}
                    aria-hidden
                  >
                    {TREND_ICON[d.trend]}
                  </span>
                  <span className="w-24 shrink-0 font-mono text-xs text-ink-3">
                    {d.label}
                  </span>
                  <span className="text-ink-2">{d.note}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* S3 保持 / 改变 */}
          <section className="border-t border-line py-8">
            <SectionHeader title="保持与改变" en="KEEP / CHANGE" />
            <div className="mt-4 grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-success">
                  需要保持
                </p>
                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-2">
                  {trend.keep.map((k, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-success">✓</span>
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-danger">
                  需要改变
                </p>
                <ul className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-2">
                  {trend.change.length ? (
                    trend.change.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-danger">✗</span>
                        {c}
                      </li>
                    ))
                  ) : (
                    <li className="text-ink-3">
                      没有发现持续性的下滑指标或高频坏习惯——保持现状即可。
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </section>

          {/* S4 高频证据 */}
          {trend.evidenceAgg.length > 0 && (
            <section className="border-t border-line py-8">
              <SectionHeader
                title="坏习惯频率"
                en="HABIT FREQUENCY"
                note="跨场次聚合的证据，出现越多越值得优先处理。"
              />
              <div className="mt-4 space-y-2">
                {trend.evidenceAgg.map((ev) => (
                  <div key={ev.issue} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 font-mono text-xs text-ink-2">
                      {ev.label}
                    </span>
                    <div className="h-[6px] flex-1 bg-board-3">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.5 }}
                        className="h-full bg-volt"
                        style={{
                          width: `${Math.min(
                            100,
                            (ev.count /
                              Math.max(1, trend.evidenceAgg[0].count)) *
                              100,
                          )}%`,
                          transformOrigin: "left",
                        }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-ink-3">
                      ×{ev.count} · {ev.matchCount} 场
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}
    </div>
  );
}
