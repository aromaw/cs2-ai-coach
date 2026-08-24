import {
  mysqlTable,
  serial,
  varchar,
  int,
  json,
  timestamp,
} from "drizzle-orm/mysql-core";

// RETAKE: 已分析的 CS2 比赛记录
// 完整分析结果（选手统计/回合/热力/道具/教练建议）以 JSON 存储，
// 列表页所需的摘要字段平铺为列以便查询。
export const matches = mysqlTable("matches", {
  id: serial("id").primaryKey(),
  fileName: varchar("file_name", { length: 255 }),
  mapName: varchar("map_name", { length: 64 }).notNull(),
  displayMap: varchar("display_map", { length: 64 }).notNull(),
  teamTName: varchar("team_t_name", { length: 128 }).notNull(),
  teamCTName: varchar("team_ct_name", { length: 128 }).notNull(),
  scoreT: int("score_t").notNull(),
  scoreCT: int("score_ct").notNull(),
  roundsTotal: int("rounds_total").notNull(),
  durationSec: int("duration_sec").notNull().default(0),
  source: varchar("source", { length: 16 }).notNull().default("upload"),
  analysis: json("analysis").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()
