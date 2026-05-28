import { L1Panel } from '../L1Panel/L1Panel'
import { L2Panel } from '../L2Panel/L2Panel'
import { CenterArea } from '../CenterArea/CenterArea'
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher'

export default function AppLayout() {
  return (
    <div className="app-container">
      {/* L1 左侧面板 */}
      <L1Panel />
      
      {/* 中央区域 - 记忆图谱/聊天 */}
      <CenterArea />
      
      {/* L2 右侧面板 */}
      <L2Panel />
      
      {/* 主题切换器 - 左下角 */}
      <ThemeSwitcher />
    </div>
  )
}
