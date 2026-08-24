// 回合与经济页的共享推导逻辑：购买类型标签、经济决策审计
import type { BuyType, RoundSummary, Side } from "@contracts/analysis";

export const BUY_LABEL: Record<BuyType, string> = {
  full_buy: "全起 FULL-BUY",
  force: "强起 FORCE",
  semi: "半起 HALF-BUY",
  full_eco: "ECO",
  unknown: "未知",
};

export const BUY_SHORT: Record<BuyType, string> = {
  full_buy: "全起",
  force: "强起",
  semi: "半起",
  full_eco: "ECO",
  unknown: "未知",
};

export type Verdict = "good" | "bad" | "neutral";

export interface EconAuditItem {
  round: number;
  side: Side;
  buyType: BuyType;
  verdict: Verdict;
  title: string;
  detail: string;
  /** 金额影响估算（正 = 净收益） */
  impact: number;
}

export function sideName(side: Side, teamT: string, teamCT: string): string {
  return side === "T" ? teamT : teamCT;
}

const fmt$ = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

/**
 * 从逐回合 buyType 与结果推导经济决策审计：
 * - eco/半起 赢下对方全起局  → ✓ eco 翻盘
 * - 强起获胜                 → ✓ 合理强起
 * - 强起/半起落败且次回合被迫 ECO → ✗ 失误
 * - 强起落败（次回合未崩盘）  → △ 存疑
 */
export function deriveEconAudit(
  rounds: RoundSummary[],
  teamT: string,
  teamCT: string,
): EconAuditItem[] {
  const items: EconAuditItem[] = [];

  rounds.forEach((r, i) => {
    // 手枪局购买为规则强制，不参与审计
    if (r.round === 1 || r.round === 13) return;
    const next = rounds[i + 1];

    (["T", "CT"] as Side[]).forEach((side) => {
      const buy = side === "T" ? r.buyTypeT : r.buyTypeCT;
      const oppBuy = side === "T" ? r.buyTypeCT : r.buyTypeT;
      const equip = side === "T" ? r.equipValueT : r.equipValueCT;
      const oppEquip = side === "T" ? r.equipValueCT : r.equipValueT;
      const won = r.winner === side;
      const team = sideName(side, teamT, teamCT);
      const nextBuy = next
        ? side === "T"
          ? next.buyTypeT
          : next.buyTypeCT
        : undefined;

      if ((buy === "full_eco" || buy === "semi") && won && oppBuy === "full_buy") {
        items.push({
          round: r.round,
          side,
          buyType: buy,
          verdict: "good",
          title: `R${r.round} · ${team} ${BUY_SHORT[buy]}翻盘`,
          detail: `低装备（${fmt$(equip)}）赢下对方全起局（${fmt$(oppEquip)}），直接摧毁对手经济`,
          impact: oppEquip - equip,
        });
      } else if (buy === "force" && won) {
        items.push({
          round: r.round,
          side,
          buyType: buy,
          verdict: "good",
          title: `R${r.round} · ${team} 强起`,
          detail: `强起投资 ${fmt$(equip)} 获胜，连败奖励重置 + 对手经济受损`,
          impact: Math.max(0, oppEquip - equip),
        });
      } else if (
        (buy === "force" || buy === "semi") &&
        !won &&
        nextBuy === "full_eco"
      ) {
        items.push({
          round: r.round,
          side,
          buyType: buy,
          verdict: "bad",
          title: `R${r.round} · ${team} ${BUY_SHORT[buy]}`,
          detail: `投入 ${fmt$(equip)} 落败，次回合被迫 ECO，相当于连送两分`,
          impact: -equip,
        });
      } else if (buy === "force" && !won) {
        items.push({
          round: r.round,
          side,
          buyType: buy,
          verdict: "neutral",
          title: `R${r.round} · ${team} 强起`,
          detail: `强起落败但次回合经济尚可维持，收益依赖低概率翻盘`,
          impact: -Math.round(equip * 0.5),
        });
      }
    });
  });

  return items.sort((a, b) => a.round - b.round).slice(0, 8);
}

/** 单回合的小型判定（详情面板用）；emphasis = 可被荧光笔圈出的关键数字子串 */
export function roundVerdict(
  r: RoundSummary,
  teamT: string,
  teamCT: string,
): { verdict: Verdict; text: string; emphasis?: string } {
  const winnerBuy = r.winner === "T" ? r.buyTypeT : r.buyTypeCT;
  const loserBuy = r.winner === "T" ? r.buyTypeCT : r.buyTypeT;
  const winnerEquip = r.winner === "T" ? r.equipValueT : r.equipValueCT;
  const loserEquip = r.winner === "T" ? r.equipValueCT : r.equipValueT;
  const team = sideName(r.winner, teamT, teamCT);

  if (
    (winnerBuy === "full_eco" || winnerBuy === "semi") &&
    loserBuy === "full_buy"
  ) {
    const emphasis = `+${fmt$(loserEquip - winnerEquip)}`;
    return {
      verdict: "good",
      text: `✓ ${team} ECO 翻盘 —— 以 ${fmt$(winnerEquip)} 装备击溃 ${fmt$(loserEquip)} 全起，经济差 ${emphasis}`,
      emphasis,
    };
  }
  if (winnerBuy === "force") {
    const emphasis = fmt$(winnerEquip);
    return {
      verdict: "good",
      text: `✓ ${team} 合理强起 —— 强起投资 ${emphasis} 转化为回合胜利`,
      emphasis,
    };
  }
  if (loserBuy === "force" || loserBuy === "semi") {
    const loser = sideName(r.winner === "T" ? "CT" : "T", teamT, teamCT);
    const emphasis = fmt$(loserEquip);
    return {
      verdict: "bad",
      text: `✗ ${loser} 强起失败 —— ${emphasis} 装备未能转化，经济承压`,
      emphasis,
    };
  }
  return {
    verdict: "neutral",
    text: `△ 常规对局 —— 双方购买决策均在默认轨道内`,
  };
}
