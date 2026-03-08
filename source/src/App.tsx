import Footer from './components/Footer'
import { McpPage } from './pages/McpPage'

export default function App() {
  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-left">
          <a href="/">
            <img src={`${import.meta.env.BASE_URL}logo_white.svg`} alt="Yeti" className="nav-logo" />
          </a>
        </div>
        <span className="nav-title">MCP Demo</span>
        <div className="nav-right" />
      </nav>
      <main className="page cols-2">
        <McpPage />
        <Footer />
      </main>
    </div>
  )
}
