import { useState, useRef, useCallback, useEffect } from 'react'
import { syntaxHighlight } from '../utils'

const MCP_URL = window.location.origin + '/demo-mcp/mcp'
const AUDIT_URL = window.location.origin + '/demo-mcp/mcpaudit?limit=50'

interface AuditEntry {
  timestamp: number
  app_id: string
  session_id?: string
  client_name?: string
  client_version?: string
  client_ip?: string
  user_agent?: string
  method: string
  tool_name?: string
  operation?: string
  arguments?: string
  status: string
  request_id?: string
  duration_ms: number
}

interface McpState {
  sessionId: string | null
  initialized: boolean
}

let nextId = 1

/** Stringify JSON, expanding any nested JSON strings in MCP content[].text fields */
function formatJson(obj: unknown): string {
  const expanded = expandMcpText(obj)
  return JSON.stringify(expanded, null, 2)
}

/** Parse stringified JSON inside result.content[].text so it renders as structured JSON */
function expandMcpText(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj
  const rec = obj as Record<string, unknown>
  if (rec.result && typeof rec.result === 'object') {
    const result = rec.result as Record<string, unknown>
    if (Array.isArray(result.content)) {
      return {
        ...rec,
        result: {
          ...result,
          content: result.content.map((item: unknown) => {
            if (item && typeof item === 'object') {
              const ci = item as Record<string, unknown>
              if (typeof ci.text === 'string') {
                try {
                  return { ...ci, text: JSON.parse(ci.text as string) }
                } catch { /* not JSON */ }
              }
            }
            return item
          }),
        },
      }
    }
  }
  return obj
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
      <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
    </svg>
  )
}

async function mcpCall(
  method: string,
  params: Record<string, unknown>,
  sessionId: string | null,
): Promise<{ result: unknown; sessionId: string | null; raw: unknown }> {
  const id = nextId++
  const body = { jsonrpc: '2.0', id, method, params }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (sessionId) headers['mcp-session-id'] = sessionId

  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(body) })
  const newSessionId = res.headers.get('mcp-session-id') || sessionId
  const data = await res.json()

  if (data.error) {
    throw { message: data.error.message || 'MCP error', code: data.error.code, raw: data }
  }

  return { result: data.result, sessionId: newSessionId, raw: data }
}

async function fetchAuditEntries(): Promise<AuditEntry[]> {
  try {
    const res = await fetch(AUDIT_URL)
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString()
}

function sourceLabel(entry: AuditEntry): string {
  return entry.client_name || 'unknown'
}

function isUiSource(entry: AuditEntry): boolean {
  const name = (entry.client_name || '').toLowerCase()
  return name.includes('ui') || name.includes('demo')
}

const EXAMPLE_ACTIONS = [
  { label: 'tools/list', method: 'tools/list', params: {} },
  { label: 'resources/list', method: 'resources/list', params: {} },
  { label: 'prompts/list', method: 'prompts/list', params: {} },
  { label: 'product_list', method: 'tools/call', params: { name: 'product_list', arguments: { limit: 10 } } },
]

export function McpPage() {
  const [search, setSearch] = useState('')
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [response, setResponse] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [mcp, setMcp] = useState<McpState>({ sessionId: null, initialized: false })
  const [copied, setCopied] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const auditListRef = useRef<HTMLDivElement>(null)

  const refreshAudit = useCallback(async () => {
    const entries = await fetchAuditEntries()
    // Reverse so oldest is first, newest at bottom
    setAuditEntries(entries.reverse())
  }, [])

  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (mcp.initialized && mcp.sessionId) return mcp.sessionId

    const { result, sessionId } = await mcpCall('initialize', {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'demo-mcp-ui', version: '1.0.0' },
    }, null)

    setMcp({ sessionId, initialized: true })
    setResponse(formatJson(result))
    return sessionId
  }, [mcp])

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) return
    setLoading(true)

    try {
      const sessionId = await ensureSession()
      const { raw } = await mcpCall('tools/call', {
        name: 'product_search',
        arguments: { filter: query, limit: 20 },
      }, sessionId)

      setResponse(formatJson(raw))
    } catch (err: unknown) {
      const error = err as { message?: string; raw?: unknown }
      setResponse(formatJson(error.raw || { error: error.message || 'Request failed' }))
    } finally {
      setLoading(false)
      // Refresh audit after a small delay to allow the server to write
      setTimeout(refreshAudit, 200)
    }
  }, [ensureSession, refreshAudit])

  const runMethod = useCallback(async (method: string, params: Record<string, unknown>, _label: string) => {
    setLoading(true)

    try {
      const sessionId = await ensureSession()
      const { raw } = await mcpCall(method, params, sessionId)
      setResponse(formatJson(raw))
    } catch (err: unknown) {
      const error = err as { message?: string; raw?: unknown }
      setResponse(formatJson(error.raw || { error: error.message || 'Request failed' }))
    } finally {
      setLoading(false)
      setTimeout(refreshAudit, 200)
    }
  }, [ensureSession, refreshAudit])

  // Auto-scroll audit list to bottom when new entries arrive
  useEffect(() => {
    if (auditListRef.current) {
      auditListRef.current.scrollTop = auditListRef.current.scrollHeight
    }
  }, [auditEntries])

  // Auto-run tools/list on mount and start audit polling
  useEffect(() => {
    runMethod('tools/list', {}, 'tools/list')
    // Poll audit entries every 3 seconds
    const interval = setInterval(refreshAudit, 3000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runSearch(search)
    setSearch('')
    inputRef.current?.focus()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(MCP_URL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleDeleteAll = async () => {
    setShowDeleteModal(false)
    try {
      await fetch(window.location.origin + '/demo-mcp/mcpaudit', { method: 'DELETE' })
      setAuditEntries([])
    } catch { /* ignore */ }
  }

  return (
    <>
      {/* Subnav — split left/right */}
      <div className="mcp-subnav">
        <div className="mcp-subnav-col">
          <span className="mcp-subnav-label">Audit Trail</span>
          <button onClick={() => setShowDeleteModal(true)} className="btn btn-sm btn-delete" disabled={auditEntries.length === 0}>
            Delete All
          </button>
        </div>
        <div className="mcp-subnav-col">
          <div className="mcp-url-box">
            <input readOnly value={MCP_URL} className="mcp-url-input" />
            <button onClick={handleCopy} title="Copy URL" className={`mcp-url-copy ${copied ? 'copied' : ''}`}>
              <CopyIcon />
            </button>
          </div>
          <span className="mcp-subnav-label" style={{ textAlign: 'right' }}>Response</span>
        </div>
      </div>

      {/* Left column: Audit Trail + Search */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="mcp-panel-body" style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Audit entries — newest at bottom */}
          <div ref={auditListRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' }}>
            {auditEntries.length === 0 ? (
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 24 }}>
                No audit entries yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 'auto' }}>
                {auditEntries.map((entry, i) => (
                  <div key={`${entry.timestamp}-${i}`} className="mcp-history-entry" style={{ cursor: 'default' }}>
                    <span className={`mcp-source-badge ${isUiSource(entry) ? 'ui' : 'agent'}`}>
                      {sourceLabel(entry)}
                    </span>
                    <span className="mcp-history-query">
                      {entry.tool_name
                        ? `${entry.method} → ${entry.tool_name}_${entry.operation || ''}`
                        : entry.method}
                    </span>
                    <span className="mcp-duration">{entry.duration_ms}ms</span>
                    <span className={`mcp-result-badge ${entry.status}`}>
                      {entry.status}
                    </span>
                    <span className="mcp-time">{formatTime(entry.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search input — pinned to bottom */}
          <div className="mcp-bottom-bar">
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search products..."
                disabled={loading}
                className="mcp-search-input"
              />
              <button className="btn btn-primary" type="submit" disabled={loading || !search.trim()}
                style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
                {loading ? '...' : 'Search'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Right column: Response + Shortcut buttons */}
      <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
        <div className="mcp-panel-body" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            {response ? (
              <pre
                className="mcp-json-output"
                dangerouslySetInnerHTML={{ __html: syntaxHighlight(response) }}
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.25)', fontSize: 14, textAlign: 'center' }}>
                <div>
                  <p>Run a search or click an example</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>JSON-RPC 2.0 responses appear here</p>
                </div>
              </div>
            )}
          </div>

          {/* Shortcut buttons — pinned to bottom */}
          <div className="mcp-bottom-bar">
            <div style={{ display: 'flex', gap: 0 }}>
              {EXAMPLE_ACTIONS.map((action, i) => (
                <button
                  key={action.label}
                  onClick={() => runMethod(action.method, action.params, action.label)}
                  disabled={loading}
                  className="mcp-example-btn"
                  style={{
                    borderLeft: i === 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                    borderRadius: i === 0 ? '4px 0 0 4px' : i === EXAMPLE_ACTIONS.length - 1 ? '0 4px 4px 0' : '0',
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2 className="modal-title">Delete Audit Trail</h2>
            <p className="modal-message">This will permanently delete all audit entries for this application.</p>
            <div className="modal-actions">
              <button onClick={() => setShowDeleteModal(false)} className="btn btn-cancel">Cancel</button>
              <button onClick={handleDeleteAll} className="btn btn-primary">Delete All</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
