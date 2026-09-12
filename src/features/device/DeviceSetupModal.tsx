import { useEffect, useRef } from 'react'
import type { Song } from '../../types/song'
import type { DeviceStatus } from './deviceTypes'
import { useMediaDevices } from './useMediaDevices'

interface DeviceSetupModalProps { song: Song; onCancel: () => void; onStart: () => void }

const statusCopy: Record<DeviceStatus, string> = {
  idle: 'Waiting', requesting: 'Requesting permission…', ready: 'Ready', denied: 'Permission denied', unavailable: 'Unavailable', error: 'Could not connect',
}

export function DeviceSetupModal({ song, onCancel, onStart }: DeviceSetupModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { microphoneStatus, cameraStatus, microphones, cameras, microphoneLevel, cameraStream, microphoneDeviceId, cameraDeviceId, selectMicrophone, selectCamera, retry } = useMediaDevices()
  const hasIssue = ['denied', 'unavailable', 'error'].includes(microphoneStatus) || ['denied', 'unavailable', 'error'].includes(cameraStatus)

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = cameraStream
  }, [cameraStream])

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCancel() }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])

  return (
    <div className="modal-backdrop leo-device-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel() }}>
      <section className="device-modal" role="dialog" aria-modal="true" aria-labelledby="device-setup-title">
        <header className="device-modal-header">
          <div><p className="status-label">Audio setup</p><h2 id="device-setup-title">Ready for {song.title}?</h2></div>
          <button className="icon-button" onClick={onCancel} aria-label="Close device setup">×</button>
        </header>

        <div className="device-grid">
          <section className="device-section microphone-setup">
            <div className="device-section-heading"><span className="device-icon" aria-hidden="true">MIC</span><div><h3>Microphone</h3><p>Check that your voice is coming through.</p></div></div>
            <label htmlFor="microphone-select">Input device</label>
            <select id="microphone-select" value={microphoneDeviceId ?? ''} onChange={(event) => selectMicrophone(event.target.value)} disabled={microphoneStatus !== 'ready' || microphones.length === 0}>
              {microphones.length === 0 && <option value="">No microphone detected</option>}
              {microphones.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
            </select>
            <div className="level-block"><span>Input level</span><div className="level-meter" role="meter" aria-label="Microphone input level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(microphoneLevel * 100)}>{Array.from({ length: 12 }, (_, index) => <i key={index} className={index < Math.ceil(microphoneLevel * 12) ? 'active' : ''} />)}</div></div>
            <DeviceStatusLine status={microphoneStatus} subject="Microphone" />
          </section>

          <section className="device-section camera-setup">
            <div className="device-section-heading"><span className="device-icon" aria-hidden="true">CAM</span><div><h3>Camera</h3><p>Position yourself in the frame.</p></div></div>
            <label htmlFor="camera-select">Video device</label>
            <select id="camera-select" value={cameraDeviceId ?? ''} onChange={(event) => selectCamera(event.target.value)} disabled={cameraStatus !== 'ready' || cameras.length === 0}>
              {cameras.length === 0 && <option value="">No camera detected</option>}
              {cameras.map((device) => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
            </select>
            <div className="camera-preview">
              {cameraStream ? <video ref={videoRef} autoPlay muted playsInline /> : <span>{cameraStatus === 'requesting' ? 'Starting camera…' : 'Camera preview unavailable'}</span>}
            </div>
            <DeviceStatusLine status={cameraStatus} subject="Camera" />
          </section>
        </div>

        <section className="browser-audio"><span className="ready-mark" aria-hidden="true">✓</span><div><strong>Audio</strong><span>{typeof AudioContext === 'undefined' ? 'Browser audio unavailable' : 'Browser audio ready'}</span></div></section>
        {hasIssue && <div className="device-warning"><p>Some interactive features will be unavailable, but you can still continue.</p><button className="text-button" onClick={retry}>Retry devices</button></div>}
        <footer className="device-actions"><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" onClick={onStart}>Start Performance</button></footer>
      </section>
    </div>
  )
}

function DeviceStatusLine({ status, subject }: { status: DeviceStatus; subject: string }) {
  const failed = status === 'denied' || status === 'unavailable' || status === 'error'
  const detail = status === 'denied' ? `${subject} permission denied` : status === 'unavailable' ? `No ${subject.toLowerCase()} detected` : statusCopy[status]
  return <p className={`device-status ${failed ? 'device-status-error' : ''}`}><span aria-hidden="true">{status === 'ready' ? '✓' : failed ? '!' : '•'}</span>{detail}</p>
}
