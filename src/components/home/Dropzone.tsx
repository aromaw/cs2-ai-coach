// V2 上传 Dropzone（home.md S1）：本页唯一 HudFrame + 唯一荧光笔圈。
// 上传逻辑：uploadDemo（@/lib/match-data）→ 成功跳 /match/{id}，失败给错误态 + 示例入口。
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check, Crosshair } from 'lucide-react'
import { cn } from '@/lib/utils'
import HudFrame from '@/components/board/HudFrame'
import Mark from '@/components/board/Mark'
import CrossMark from '@/components/board/CrossMark'
import { uploadDemo } from '@/lib/match-data'

const STEPS = ['读取文件', '解析回合', '计算指标', '生成教练建议'] as const

type Phase = 'idle' | 'parsing' | 'error'

export default function Dropzone() {
  const [dragOver, setDragOver] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const rafRef = useRef(0)
  const navigate = useNavigate()

  // 解析期间进度模拟：向 90% 收敛，真实请求完成后补到 100%
  useEffect(() => {
    if (phase !== 'parsing') return
    const t0 = performance.now()
    const tick = () => {
      const elapsed = (performance.now() - t0) / 1000
      const p = Math.min(90, Math.round(90 * (1 - Math.exp(-elapsed / 1.4))))
      setProgress(p)
      setStep(Math.min(STEPS.length - 1, Math.floor((p / 100) * STEPS.length)))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [phase])

  const startUpload = useCallback(
    async (file: File) => {
      if (phase === 'parsing') return
      if (!file.name.toLowerCase().endsWith('.dem')) {
        setPhase('error')
        setError('仅支持 CS2 录像文件（.dem）')
        return
      }
      setError(null)
      setProgress(0)
      setStep(0)
      setPhase('parsing')
      try {
        const id = await uploadDemo(file)
        cancelAnimationFrame(rafRef.current)
        setProgress(100)
        setStep(STEPS.length - 1)
        window.setTimeout(() => navigate(`/match/${id}`), 350)
      } catch (err) {
        cancelAnimationFrame(rafRef.current)
        setPhase('error')
        setError(err instanceof Error ? err.message : '上传失败，请重试')
      }
    },
    [phase, navigate],
  )

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void startUpload(f)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void startUpload(f)
  }

  const reset = (e: React.MouseEvent) => {
    e.stopPropagation()
    setPhase('idle')
    setError(null)
    inputRef.current?.click()
  }

  return (
    <HudFrame
      className={cn(
        'p-2.5 transition-colors duration-200',
        // drag-over：HudFrame 四角转 volt
        dragOver && '[&>span]:border-volt',
      )}
    >
      {/* drag-over 时 volt 虚线脉冲（仅交互态，非常驻装饰） */}
      <style>{`@keyframes dz-pulse{0%,100%{border-color:#C8FF3D}50%{border-color:rgba(200,255,61,0.35)}}`}</style>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => phase === 'idle' && inputRef.current?.click()}
        className={cn(
          'cursor-pointer rounded-sm border border-dashed border-line-strong p-8 transition-colors duration-200',
          dragOver && 'dz-drag bg-volt-dim',
        )}
        style={dragOver ? { animation: 'dz-pulse 1.2s ease-in-out infinite' } : undefined}
      >
        <input ref={inputRef} type="file" accept=".dem" className="hidden" onChange={onPick} />

        {phase === 'idle' && (
          <div className="flex flex-col items-center text-center">
            <Crosshair className="h-8 w-8 text-ink-3" strokeWidth={1.5} />
            <p className="relative mt-5 inline-block text-sm font-medium text-ink-1">
              拖拽 .dem 文件到此处
              {/* 全站第一印象的"教练圈重点"：静止 0.6s 后画出 */}
              <Mark type="circle" delay={0.6} />
            </p>
            <p className="mt-1.5 text-sm text-ink-2">
              或 <span className="text-volt underline underline-offset-4">点击选择文件</span>
            </p>
            <p className="mt-5 text-xs text-ink-3">
              支持 50–300MB · 解析在本地服务器完成，录像不上传至第三方
            </p>
            <div className="mt-4 flex w-full justify-end">
              <Link
                to="/match/demo"
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-xs text-ink-2 transition-colors duration-200 hover:text-volt"
              >
                先看看示例分析 →
              </Link>
            </div>
          </div>
        )}

        {phase === 'parsing' && (
          <div className="w-full cursor-default" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-end justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-3">
                Parsing Demo
              </span>
              <span className="font-mono text-3xl font-bold tabular-nums leading-none text-volt">
                {progress}%
              </span>
            </div>
            <ul className="mt-5 space-y-2.5">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2.5 text-sm">
                  {i < step || progress >= 100 ? (
                    <Check className="h-3.5 w-3.5 text-volt" strokeWidth={2.5} />
                  ) : i === step ? (
                    <CrossMark volt size={14} className="animate-pulse" />
                  ) : (
                    <CrossMark size={14} />
                  )}
                  <span className={i <= step || progress >= 100 ? 'text-ink-1' : 'text-ink-3'}>
                    {s}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex cursor-default flex-col items-center text-center" onClick={(e) => e.stopPropagation()}>
            <Crosshair className="h-8 w-8 text-danger" strokeWidth={1.5} />
            <p className="mt-5 text-sm font-medium text-ink-1">解析失败</p>
            <p className="mt-1.5 max-w-sm text-xs text-danger">{error}</p>
            <div className="mt-6 flex items-center gap-5">
              <button
                type="button"
                onClick={reset}
                className="rounded-sm border border-volt/60 px-4 py-1.5 font-mono text-xs uppercase tracking-wider text-volt transition-colors duration-200 hover:bg-volt hover:text-board-0"
              >
                重新上传
              </button>
              <Link
                to="/match/demo"
                className="font-mono text-xs text-ink-2 transition-colors duration-200 hover:text-volt"
              >
                先看看示例分析 →
              </Link>
            </div>
          </div>
        )}
      </div>
    </HudFrame>
  )
}
