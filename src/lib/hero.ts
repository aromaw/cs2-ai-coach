// "我是谁"：由上传者自己选择，按比赛 id 记忆在 localStorage。
// 选择通过 CustomEvent 同步到同页面的所有使用方。
import { useCallback, useEffect, useState } from "react";
import type { PlayerStat } from "@contracts/analysis";
import { pickDefaultPlayer } from "@/components/player/utils";

const EVENT = "retake:hero-changed";

export interface HeroState {
  /** 当前生效的玩家（手动选择优先，未选时回退 rating 最高的 T 方玩家） */
  effective: PlayerStat | undefined;
  /** 手动选择的玩家（可能为 undefined） */
  hero: PlayerStat | undefined;
  /** 未选择时的自动回退玩家 */
  fallback: PlayerStat | undefined;
  /** 是否处于自动回退状态（用户尚未手动选择） */
  isAuto: boolean;
  heroName: string;
  select: (name: string) => void;
}

export function useHero(
  matchId: string | number | undefined,
  players: PlayerStat[],
): HeroState {
  const key = matchId === undefined ? "" : `retake:hero:${String(matchId)}`;
  const [state, setState] = useState<{ key: string; name: string }>({
    key,
    name: key ? (localStorage.getItem(key) ?? "") : "",
  });
  // matchId 切换时在渲染期间派生（避免 effect 内同步 setState）
  const heroName =
    state.key === key
      ? state.name
      : key
        ? (localStorage.getItem(key) ?? "")
        : "";

  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ key: string; name: string }>).detail;
      if (d && d.key === key) setState({ key, name: d.name });
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, [key]);

  const select = useCallback(
    (name: string) => {
      if (!key) return;
      localStorage.setItem(key, name);
      setState({ key, name });
      window.dispatchEvent(
        new CustomEvent(EVENT, { detail: { key, name } }),
      );
    },
    [key],
  );

  const hero = players.find((p) => p.name === heroName);
  const fallback = pickDefaultPlayer(players);
  return {
    hero,
    fallback,
    effective: hero ?? fallback,
    isAuto: !hero && fallback !== undefined,
    heroName,
    select,
  };
}
