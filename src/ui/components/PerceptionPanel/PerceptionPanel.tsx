import { useEffect } from 'react'
import { useKernelDataStore } from '../../../stores/kernelDataStore'

const Section = ({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) => (
  <div style={{
    padding: '10px 12px', borderRadius: '8px',
    border: '1px solid var(--border)', background: 'var(--bg-elevated)',
    marginBottom: '6px',
  }}>
    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span>{icon}</span> {title}
    </div>
    {children}
  </div>
)

const KV = ({ label, value }: { label: string; value: any }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '11px' }}>
    <span style={{ color: 'var(--text-dim)' }}>{label}</span>
    <span style={{ color: 'var(--text)', fontWeight: 500, textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>
      {value ?? '-'}
    </span>
  </div>
)

export function PerceptionPanel() {
  const { perception, perceptionLoading, loadPerception } = useKernelDataStore()

  useEffect(() => {
    loadPerception()
    const timer = setInterval(loadPerception, 30000)
    return () => clearInterval(timer)
  }, [loadPerception])

  const data = perception

  return (
    <div style={{ padding: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>感知系统</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {data?.timestamp && (
            <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
              {new Date(data.timestamp).toLocaleTimeString()}
            </span>
          )}
          <button onClick={loadPerception} disabled={perceptionLoading}
            style={{
              padding: '4px 8px', borderRadius: '4px',
              border: '1px solid var(--border)', background: 'transparent',
              color: 'var(--text-dim)', cursor: perceptionLoading ? 'wait' : 'pointer', fontSize: '11px',
            }}
          >
            {perceptionLoading ? '...' : '刷新'}
          </button>
        </div>
      </div>

      {perceptionLoading && !data ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>加载中...</div>
      ) : !data ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '32px' }}>
          感知系统未连接，Kernel 启动后自动激活
        </div>
      ) : (
        <div>
          <Section title="活跃窗口" icon="🖥️">
            {data.active_window?.process_name ? (
              <div>
                <KV label="进程" value={data.active_window.process_name} />
                <KV label="标题" value={data.active_window.window_title} />
                {data.active_window.is_vscode && (
                  <>
                    <KV label="编辑器" value="VS Code" />
                    {data.active_window.vscode_parse?.file && (
                      <KV label="文件" value={data.active_window.vscode_parse.file} />
                    )}
                    {data.active_window.vscode_parse?.project && (
                      <KV label="项目" value={data.active_window.vscode_parse.project} />
                    )}
                  </>
                )}
                {data.active_window.rect && (
                  <KV label="窗口大小" value={`${data.active_window.rect.width}x${data.active_window.rect.height}`} />
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>无窗口信息</div>
            )}
          </Section>

          <Section title="Git 状态" icon="🔀">
            {data.git?.is_git_repo ? (
              <div>
                <KV label="分支" value={data.git.branch} />
                <KV label="仓库" value={data.git.repo_root} />
                {data.git.unstaged_count > 0 && (
                  <KV label="未暂存" value={`${data.git.unstaged_count} 文件`} />
                )}
                {data.git.staged_count > 0 && (
                  <KV label="已暂存" value={`${data.git.staged_count} 文件`} />
                )}
                {data.git.untracked_count > 0 && (
                  <KV label="未追踪" value={`${data.git.untracked_count} 文件`} />
                )}
                {data.git.recent_commits?.length > 0 && (
                  <div style={{ marginTop: '4px' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '2px' }}>最近提交</div>
                    {data.git.recent_commits.slice(0, 3).map((c: any, i: number) => (
                      <div key={i} style={{ fontSize: '10px', color: 'var(--text)', padding: '1px 0', display: 'flex', gap: '4px' }}>
                        <span style={{ color: 'var(--text-dim)' }}>[{c.hash?.slice(0, 7)}]</span>
                        <span>{c.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>不在 Git 仓库中</div>
            )}
          </Section>

          <Section title="项目信息" icon="📁">
            {data.project?.name ? (
              <div>
                <KV label="名称" value={data.project.name} />
                <KV label="类型" value={data.project.type} />
                <KV label="语言" value={data.project.language} />
                <KV label="依赖数" value={data.project.dependency_count} />
                {data.project.entry_files?.length > 0 && (
                  <KV label="入口" value={data.project.entry_files.slice(0, 3).join(', ')} />
                )}
                {data.project.build_files?.length > 0 && (
                  <KV label="构建" value={data.project.build_files.join(', ')} />
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>无项目信息</div>
            )}
          </Section>

          {data.formatted && (
            <Section title="感知摘要" icon="📝">
              <div style={{
                fontSize: '11px', color: 'var(--text)', lineHeight: 1.6,
                whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto',
                background: 'var(--bg)', padding: '8px', borderRadius: '4px',
              }}>
                {data.formatted}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
