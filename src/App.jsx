import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Battery,
  BellRing,
  Camera,
  CheckCircle,
  Clock,
  Cpu,
  Droplets,
  Eye,
  Flame,
  Gauge,
  MapPin,
  Radio,
  RefreshCw,
  Shield,
  Thermometer,
  Wifi,
  Wind,
} from "lucide-react";
import "./App.css";

const API_URL = "http://127.0.0.1:5000";
const CAMERA_URL = `${API_URL}/api/camera`;

function App() {
  const [sensors, setSensors] = useState({
    temperature: "--",
    humidity: "--",
    gas: "--",
    battery: "--",
    risk_level: "WAITING",
  });
  const [detections, setDetections] = useState([]);
  const [system, setSystem] = useState({});
  const [location, setLocation] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("--");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      // GPS is fetched separately so a GPS issue does not break other dashboard data.
      const mainResponses = await Promise.all([
        fetch(`${API_URL}/api/status`),
        fetch(`${API_URL}/api/sensors`),
        fetch(`${API_URL}/api/detections`),
        fetch(`${API_URL}/api/system`),
      ]);

      if (mainResponses.some((response) => !response.ok)) {
        throw new Error("One or more dashboard APIs failed");
      }

      const [statusData, sensorData, detectionData, systemData] =
        await Promise.all(mainResponses.map((response) => response.json()));

      setBackendOnline(true);

      const sensorValues =
        sensorData.sensors || sensorData.latest || sensorData.data || sensorData;

      setSensors((previous) => ({
        ...previous,
        ...sensorValues,
        risk_level:
          sensorValues.risk_level ||
          sensorValues.risk ||
          previous.risk_level,
      }));

      const detectionValues = Array.isArray(detectionData)
        ? detectionData
        : detectionData.detections || detectionData.data || [];

      const normalizedDetections = detectionValues
        .map((item) => ({
          ...item,
          object_name:
            item.object_name || item.class_name || item.label || "Unknown object",
          confidence: Number(item.confidence ?? item.score ?? 0),
        }))
        .sort((a, b) => {
          const timeA = new Date(a.created_at || a.timestamp || 0).getTime();
          const timeB = new Date(b.created_at || b.timestamp || 0).getTime();
          return (
            (Number.isFinite(timeB) ? timeB : 0) -
            (Number.isFinite(timeA) ? timeA : 0)
          );
        });

      setDetections(normalizedDetections.slice(0, 20));
      setSystem({ ...statusData, ...systemData });
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      setBackendOnline(false);
      console.error("Dashboard API error:", error.message);
    }

    try {
      const response = await fetch(`${API_URL}/api/location`);
      if (!response.ok) throw new Error(`GPS API returned ${response.status}`);
      const locationData = await response.json();
      if (!locationData.success) throw new Error("GPS API returned no location");
      setLocation(locationData);
      setLocationError(false);
    } catch (error) {
      setLocationError(true);
      console.error("GPS API error:", error.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  function formatValue(value, suffix = "") {
    if (value === undefined || value === null || value === "") return "--";
    if (value === "--") return value;
    return `${value}${suffix}`;
  }

  function getRiskClass(value) {
    const risk = String(value || "WAITING").toUpperCase();
    if (risk === "CRITICAL") return "critical";
    if (risk === "HIGH") return "high";
    if (risk === "MEDIUM") return "medium";
    if (risk === "LOW") return "low";
    return "unknown";
  }

  function getDetectionTime(item) {
    const value = item.created_at || item.timestamp || item.time;
    if (!value) return "Time not available";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function isFireOrSmoke(item) {
    return /fire|smoke/i.test(item.object_name || "");
  }

  const fireSmokeDetections = detections.filter(isFireOrSmoke);
  const latestFireSmoke = fireSmokeDetections[0] || null;
  const risk = String(sensors.risk_level || "WAITING").toUpperCase();
  const highRisk = risk === "HIGH" || risk === "CRITICAL";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon"><Shield size={26} /></div>
          <div>
            <h2>RescueAI</h2>
            <span>Search &amp; Rescue Rover</span>
          </div>
        </div>

        <div className="sidebar-label">MAIN MENU</div>
        <nav className="navigation">
          <a href="#dashboard" className="nav-link active"><Activity size={19} />Dashboard</a>
          <a href="#camera" className="nav-link"><Camera size={19} />Live Camera</a>
          <a href="#detections" className="nav-link"><Eye size={19} />AI Detection</a>
          <a href="#sensors" className="nav-link"><Gauge size={19} />Sensors</a>
          <a href="#location" className="nav-link"><MapPin size={19} />Location</a>
        </nav>

        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className={`status-dot ${backendOnline ? "online" : "offline"}`} />
            <div>
              <strong>{backendOnline ? "Backend Online" : "Backend Offline"}</strong>
              <p>Flask API Connection</p>
            </div>
          </div>
          <div className="sidebar-footer">
            AI Search &amp; Rescue Rover<br />Development Version 1.2
          </div>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div>
            <p className="eyebrow">RESCUE OPERATIONS / OVERVIEW</p>
            <h1>Mission Control Dashboard</h1>
            <p className="subtitle">Monitor rover status, camera feed, AI detections, sensors and GPS location.</p>
          </div>
          <div className="topbar-right">
            <div className="connection-pill">
              <span className={`status-dot ${backendOnline ? "online" : "offline"}`} />
              {backendOnline ? "System Connected" : "Disconnected"}
            </div>
            <button className="refresh-button" onClick={fetchData} disabled={refreshing}>
              <RefreshCw size={16} />{refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </header>

        <section className="welcome-banner">
          <div className="welcome-copy">
            <div className="banner-label"><Radio size={15} />SEARCH &amp; RESCUE INTELLIGENCE</div>
            <h2>Situational Awareness at a Glance</h2>
            <p>Monitor the environment using camera video, AI-powered fire and smoke detection, GPS coordinates and sensor-based risk assessment.</p>
            <a href="#camera" className="primary-link"><Camera size={17} />View Live Camera</a>
          </div>
          <div className="banner-art">
            <div className="radar radar-one" />
            <div className="radar radar-two" />
            <div className="radar-core"><Shield size={42} /></div>
            <span className="radar-point point-one" />
            <span className="radar-point point-two" />
            <span className="radar-point point-three" />
          </div>
        </section>

        {latestFireSmoke && (
          <section className="fire-alert" role="status">
            <div className="fire-alert-icon"><Flame size={25} /></div>
            <div className="fire-alert-content">
              <div className="fire-alert-heading"><BellRing size={15} /><strong>Fire / Smoke Detection Recorded</strong></div>
              <p>Detected: <strong>{latestFireSmoke.object_name}</strong> — confidence <strong>{latestFireSmoke.confidence <= 1 ? `${(latestFireSmoke.confidence * 100).toFixed(1)}%` : `${latestFireSmoke.confidence.toFixed(1)}%`}</strong></p>
              <span className="alert-time"><Clock size={13} />{getDetectionTime(latestFireSmoke)}</span>
              <p className="alert-disclaimer">Verify the camera feed and situation. This is an AI detection record, not confirmed proof of an emergency.</p>
            </div>
            <a href="#detections" className="alert-link">View Record</a>
          </section>
        )}

        {highRisk && (
          <section className="risk-alert" role="status">
            <AlertTriangle size={20} />
            <div><strong>{risk} Environmental Risk</strong><p>Check the current sensor readings and inspect the environment.</p></div>
          </section>
        )}

        <section className="stats-grid">
          <StatCard icon={<Thermometer size={21} />} label="Temperature" value={formatValue(sensors.temperature, "°C")} note="Environmental sensor" color="orange" />
          <StatCard icon={<Droplets size={21} />} label="Humidity" value={formatValue(sensors.humidity, "%")} note="Relative humidity" color="blue" />
          <StatCard icon={<Wind size={21} />} label="Gas / Smoke" value={formatValue(sensors.gas)} note="Sensor reading" color="purple" />
          <StatCard icon={<Battery size={21} />} label="Battery" value={formatValue(sensors.battery, "%")} note="Power monitoring" color="green" />
        </section>

        <section className="content-grid">
          <div className="panel camera-panel" id="camera">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-icon"><Camera size={19} /></div>
                <div><h3>Live Camera Feed</h3><p>USB camera with AI detection</p></div>
              </div>
              <span className="live-label"><span className="live-dot" />LIVE</span>
            </div>
            <div className="camera-feed">
              {!cameraError ? (
                <img src={CAMERA_URL} alt="Live search and rescue camera" className="live-camera"
                  onError={() => setCameraError(true)} onLoad={() => setCameraError(false)} />
              ) : (
                <div className="camera-placeholder">
                  <Camera size={45} /><h3>Camera Feed Unavailable</h3>
                  <p>Ensure Flask is running and the webcam is accessible.</p>
                  <button className="refresh-button" onClick={() => setCameraError(false)}><RefreshCw size={15} />Retry Camera</button>
                </div>
              )}
              <div className="camera-overlay">
                <span><span className="status-dot online" />AI VISION</span>
                <span>FIRE / SMOKE MODEL</span>
              </div>
            </div>
            <div className="camera-footer">
              <div><span className="muted-label">STREAM</span><strong>Flask MJPEG</strong></div>
              <div><span className="muted-label">MODEL</span><strong>Custom YOLO</strong></div>
              <div><span className="muted-label">PROCESSING</span><strong>CPU</strong></div>
            </div>
          </div>

          <div className="panel risk-panel">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-icon"><AlertTriangle size={19} /></div>
                <div><h3>Environmental Risk</h3><p>Sensor-based assessment</p></div>
              </div>
            </div>
            <div className={`risk-display ${getRiskClass(risk)}`}>
              <div className="risk-shield"><Shield size={35} /></div>
              <span className="risk-caption">CURRENT RISK LEVEL</span>
              <h2>{risk}</h2>
              <p>{risk === "CRITICAL" ? "Critical sensor readings detected. Inspect immediately." : risk === "HIGH" ? "Elevated readings. Check the environment." : risk === "MEDIUM" ? "Monitor sensor readings carefully." : risk === "LOW" ? "Current readings indicate a low risk level." : "Waiting for sensor data."}</p>
            </div>
            <div className="risk-details">
              <div><span>Backend status</span><strong>{backendOnline ? "Connected" : "Offline"}</strong></div>
              <div><span>Last data update</span><strong>{lastUpdated}</strong></div>
              <div><span>Fire / smoke records</span><strong>{fireSmokeDetections.length}</strong></div>
            </div>
          </div>
        </section>

        <section className="content-grid lower-grid">
          <div className="panel sensors-panel" id="sensors">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-icon"><Gauge size={19} /></div>
                <div><h3>Environmental Sensors</h3><p>Latest readings from the backend</p></div>
              </div>
              <span className="small-tag">LIVE DATA</span>
            </div>
            <div className="sensor-list">
              <SensorRow icon={<Thermometer size={18} />} label="Temperature" value={formatValue(sensors.temperature, " °C")} />
              <SensorRow icon={<Droplets size={18} />} label="Humidity" value={formatValue(sensors.humidity, "%")} />
              <SensorRow icon={<Wind size={18} />} label="Gas / Smoke Level" value={formatValue(sensors.gas)} />
              <SensorRow icon={<Battery size={18} />} label="Battery Level" value={formatValue(sensors.battery, "%")} />
            </div>
          </div>

          <div className="panel detections-panel" id="detections">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-icon"><Eye size={19} /></div>
                <div><h3>Recent AI Detections</h3><p>Recorded detections from SQLite API</p></div>
              </div>
              <span className="small-tag">{detections.length} RECORDS</span>
            </div>
            {detections.length > 0 ? (
              <div className="detection-list">
                {detections.slice(0, 8).map((item, index) => {
                  const dangerous = isFireOrSmoke(item);
                  const confidence = item.confidence <= 1 ? `${(item.confidence * 100).toFixed(1)}%` : `${item.confidence.toFixed(1)}%`;
                  return (
                    <div className="detection-row" key={item.id || `${item.object_name}-${index}`}>
                      <div className={`detection-icon ${dangerous ? "danger-icon" : ""}`}>{dangerous ? <Flame size={19} /> : <Eye size={19} />}</div>
                      <div className="detection-info"><strong>{item.object_name}</strong><span>{getDetectionTime(item)}</span></div>
                      <div className={`detection-confidence ${dangerous ? "danger-confidence" : ""}`}>{confidence}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state"><CheckCircle size={30} /><h4>No detections recorded yet</h4><p>Detected objects will appear here after the backend saves them to the database.</p></div>
            )}
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel system-panel" id="location">
            <div className="panel-header">
              <div className="panel-title">
                <div className="panel-icon"><MapPin size={19} /></div>
                <div><h3>Rover GPS Location</h3><p>Location monitoring and coordinates</p></div>
              </div>
              <span className="small-tag">{locationError ? "OFFLINE" : location?.is_live_gps ? "LIVE GPS" : location ? "SIMULATED" : "LOADING"}</span>
            </div>

            {location && !locationError ? (
              <>
                <div className="sensor-list">
                  <SensorRow icon={<MapPin size={18} />} label="Location" value={location.location_name || "--"} />
                  <SensorRow icon={<Activity size={18} />} label="Latitude" value={location.latitude ?? "--"} />
                  <SensorRow icon={<Activity size={18} />} label="Longitude" value={location.longitude ?? "--"} />
                  <SensorRow icon={<Radio size={18} />} label="GPS Status" value={location.gps_status || "UNKNOWN"} />
                </div>
                {location.map_url && (
                  <a className="primary-link" href={location.map_url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, marginTop: 18, textDecoration: "none" }}>
                    <MapPin size={17} />Open in Google Maps
                  </a>
                )}
                <p className="system-note">
                  {location.is_live_gps ? "Coordinates received from a live GPS source." : "Demo coordinates only. Live GPS hardware is not connected."}
                </p>
                <p className="system-note">Last location response: {location.timestamp || "--"}</p>
              </>
            ) : (
              <div className="empty-state"><MapPin size={30} /><h4>GPS Data Unavailable</h4><p>Check that the Flask backend and /api/location endpoint are running.</p></div>
            )}
          </div>

          <div className="panel system-panel">
            <div className="panel-title">
              <div className="panel-icon"><Cpu size={19} /></div>
              <div><h3>System Status</h3><p>Backend and monitoring services</p></div>
            </div>
            <div className="system-status-list">
              <StatusRow icon={<Wifi size={17} />} label="Flask API" value={backendOnline ? "Online" : "Offline"} online={backendOnline} />
              <StatusRow icon={<Camera size={17} />} label="Camera Stream" value={cameraError ? "Check camera" : backendOnline ? "Requested" : "Unavailable"} online={!cameraError && backendOnline} />
              <StatusRow icon={<Activity size={17} />} label="Dashboard Polling" value="Every 3 seconds" online />
              <StatusRow icon={<MapPin size={17} />} label="GPS API" value={!locationError && location ? "Online" : "Offline"} online={!locationError && Boolean(location)} />
            </div>
            <p className="system-note">Dashboard data refreshes automatically every 3 seconds.</p>
          </div>
        </section>

        <footer className="page-footer">
          <span>RescueAI Search &amp; Rescue Rover</span>
          <span>Last dashboard update: {lastUpdated}</span>
        </footer>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, note, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div className="stat-content"><p>{label}</p><h2>{value}</h2><span>{note}</span></div>
    </div>
  );
}

function SensorRow({ icon, label, value }) {
  return (
    <div className="sensor-row">
      <div className="sensor-row-icon">{icon}</div>
      <span className="sensor-row-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusRow({ icon, label, value, online }) {
  return (
    <div className="status-row">
      <div className="status-row-icon">{icon}</div>
      <span>{label}</span>
      <strong className={online ? "text-online" : "text-offline"}>
        <span className={`status-dot ${online ? "online" : "offline"}`} />
        {value}
      </strong>
    </div>
  );
}

export default App;
