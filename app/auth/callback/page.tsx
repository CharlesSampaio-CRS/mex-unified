'use client'

import { useEffect, useRef } from 'react'

export default function OAuthCallback() {
  const hasRun = useRef(false)
  
  useEffect(() => {
    // Evita executar 2x no desenvolvimento (React Strict Mode)
    if (hasRun.current) return
    hasRun.current = true
    
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const accessToken = urlParams.get('access_token')
    const userId = urlParams.get('user_id')
    const email = urlParams.get('email')
    const name = urlParams.get('name')
    
    if (!accessToken || !userId || !email) {
      console.error('OAuth callback: missing required parameters')
      return
    }
    
    // Create OAuth data object
    const oauthData = {
      type: 'OAUTH_SUCCESS',
      access_token: accessToken,
      user_id: userId,
      email: email,
      name: name || '',
      timestamp: Date.now()
    }
    
    try {
      // Save to localStorage
      localStorage.setItem('oauth_result', JSON.stringify(oauthData))
    } catch (error) {
      console.error('Error saving OAuth result to localStorage:', error)
    }
    
    // Check if this is a popup and close it
    const isPopup = window.opener !== null
    if (isPopup) {
      setTimeout(() => {
        try {
          window.close()
        } catch (err) {
          console.error('Could not close popup:', err)
        }
      }, 1000)
    }
  }, [])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: 'system-ui',
      padding: '20px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>🎯 OAuth Callback</h1>
        <p style={{ fontSize: '20px', marginBottom: '20px' }}>Processing authentication...</p>
        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: '20px', 
          borderRadius: '10px',
          marginTop: '20px',
          textAlign: 'left',
          fontSize: '16px',
          fontFamily: 'monospace'
        }}>
          <div>🎯 <strong>Debug Mode Active!</strong></div>
          <div style={{ marginTop: '10px' }}>
            📊 <strong>Open DevTools Console (F12)</strong>
          </div>
          <div style={{ marginTop: '10px' }}>
            🔍 Look for <code style={{ background: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '3px' }}>🎯</code> logs
          </div>
          <div style={{ marginTop: '10px' }}>
            {typeof window !== 'undefined' && window.opener ? (
              <>🚪 Popup will close in 1 second...</>
            ) : (
              <>🖥️ Not a popup - refresh to test again</>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
