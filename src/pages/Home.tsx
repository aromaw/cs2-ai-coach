// V2 落地页（design-v2/home.md）：战术板大门——纯板面 Hero + 上传区 + 三格能力预览 + 收尾 CTA。
// 已移除全部 GSAP / ScrollTrigger / Lenis；动效仅白名单内（淡入 / 荧光笔 draw / HudFrame 生长）。
import { motion } from 'framer-motion'
import CrossMark from '@/components/board/CrossMark'
import SectionHeader from '@/components/board/SectionHeader'
import CoachNote from '@/components/board/CoachNote'
import Dropzone from '@/components/home/Dropzone'
import AbilityGrid from '@/components/home/AbilityGrid'

const EASE = [0.22, 1, 0.36, 1] as [number, number, number, number]

export default function Home() {
  const scrollToUpload = () => {
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="-mt-14">
      {/* -mt-14 cancels the Layout nav offset so the hero is truly full-bleed */}

      {/* S1 — Hero 战术板（100vh） */}
      <section className="board-glow relative flex h-[100svh] min-h-[680px] flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-[1360px] px-6 pt-14 md:px-10">
          {/* 板头行 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="flex items-center gap-3"
          >
            <CrossMark volt size={16} />
            <p className="font-mono text-[11px] tracking-[0.3em] text-ink-3">
              CS2 DEMO ANALYZER · 教练级复盘引擎
            </p>
          </motion.div>

          {/* 主标题（JetBrains Mono 巨型等宽） */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
            className="mt-8 font-mono text-5xl font-bold leading-[1.05] tracking-tight text-ink-1 md:text-7xl"
          >
            EVERY ROUND
            <br />
            TELLS A STORY<span className="text-volt">.</span>
          </motion.h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.2, ease: EASE }}
          >
            <p className="mt-4 text-base text-ink-2">每一个回合，都值得复盘。</p>
            <p className="mt-6 max-w-lg text-sm leading-relaxed text-ink-2">
              上传你的 CS2 录像文件（.dem），60
              秒内获得职业选手级别的数据分析——个人表现、经济决策、走位热力，以及一份为你写的教练报告。
            </p>

            {/* 上传 Dropzone：本页唯一 HudFrame + 唯一荧光笔 */}
            <div id="upload" className="mt-10 max-w-xl scroll-mt-24">
              <Dropzone />
            </div>
          </motion.div>
        </div>

        {/* 右下角数据条 */}
        <p className="absolute bottom-8 right-10 hidden font-mono text-xs text-ink-3 lg:block">
          已解析 <span className="text-ink-1">12,847</span> 场 · 平均解析{' '}
          <span className="text-ink-1">38s</span>
        </p>

        {/* Hero 底部压暗叠层（与下一分区衔接） */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
          style={{
            backgroundImage: 'linear-gradient(to top, #0A0D10, transparent)',
          }}
          aria-hidden
        />
      </section>

      {/* S2 — 你会得到什么（通栏发丝线，线中点嵌准星） */}
      <div className="relative border-t border-line">
        <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 bg-board-0 px-2.5">
          <CrossMark size={16} />
        </span>
      </div>
      <section className="mx-auto max-w-[1360px] px-6 py-14 md:px-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <SectionHeader title="你会得到什么" en="WHAT YOU GET" />
          <AbilityGrid />
          <div className="mt-12 max-w-md">
            <CoachNote
              tilt="right"
              className="[&>div:last-child]:text-lg [&>div:last-child]:md:text-lg"
            >
              → 数据告诉你发生了什么，教练告诉你该怎么办。
            </CoachNote>
          </div>
        </motion.div>
      </section>

      {/* S3 — 收尾 CTA（Footer 由 Layout 统一渲染） */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-[1360px] px-6 py-16 text-center md:px-10">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <h2 className="font-mono text-3xl font-bold leading-snug text-ink-1 md:text-5xl">
              你的下一场进步，从上一场复盘开始。
            </h2>
            <button
              type="button"
              onClick={scrollToUpload}
              className="mt-8 rounded-sm bg-volt px-8 py-3.5 font-mono text-sm font-semibold uppercase tracking-wider text-board-0 transition-[filter] duration-200 hover:brightness-110"
            >
              上传 .DEM 文件
            </button>
            <p className="mt-4 text-xs text-ink-3">无需注册 · 解析历史保存在本账号下</p>
          </motion.div>
        </div>
      </section>
    </div>
  )
}
