import { SidePanel } from '../SidePanel/SidePanel'
import { CenterArea } from '../CenterArea/CenterArea'
import { ThemeSwitcher } from '../ThemeSwitcher/ThemeSwitcher'

export default function AppLayout() {
  return (
    <div className="app-container">
      {/* 左侧面板 - 多层思考流 */}
      <SidePanel />
      
      {/* 中央区域 - 记忆图谱/聊天 */}
      <CenterArea />
      
      {/* 设置按钮 */}
      <ThemeSwitcher />
    </div>
  )
}
