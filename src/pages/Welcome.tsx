import { Link } from 'react-router-dom'
import logo from '../assets/w8pool-logo.png'

export default function Welcome() {
  return (
    <div className="welcome">
      <div className="welcome-card">
        <img src={logo} alt="W8Pool" className="welcome-logo" />
        <h1 className="welcome-title">W8Pool <span className="welcome-title-dot">·</span> 我的求职岗位池</h1>
        <p className="welcome-developer">开发者：Wendy Wei</p>
        <div className="welcome-actions">
          <Link
            to="/preview"
            className="btn btn-outline welcome-btn"
            title="无需登录，可完整体验所有功能，已填充虚构的演示数据。"
          >
            我要体验：访客模式
            <span className="welcome-btn-sub">
              无需登录，可完整体验所有功能，<br className="mobile-welcome-break" />已填充虚构的演示数据。
            </span>
          </Link>
        </div>
        <div className="workspace-box">
          <Link
            to="/workspace"
            className="btn welcome-btn"
            title="管理个人岗位池与求职进展。"
          >
            登录工作台
            <span className="welcome-btn-sub">
              汇集机会，沉淀选择，<br className="mobile-welcome-break" />管理个人岗位池与求职进展。
            </span>
          </Link>
          <div className="welcome-register-link">
            <Link to="/register">首次使用，创建账户</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
