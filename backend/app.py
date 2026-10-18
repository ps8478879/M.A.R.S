
import os
import time
import sqlite3
import threading
from datetime import datetime

import cv2
from flask import Flask, jsonify, Response, request
from flask_cors import CORS

try:
    from ultralytics import YOLO
except ImportError:
    YOLO = None


# --------------------------------------------------
# Flask Configuration
# --------------------------------------------------

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "rescue_rover.db")
MODEL_PATH = os.path.join(BASE_DIR, "models", "fire_smoke_best.pt")


# --------------------------------------------------
# GPS Configuration
# --------------------------------------------------
# Demo coordinates only. These are NOT live GPS readings.

GPS_DATA = {
    "latitude": 26.4499,
    "longitude": 80.3319,
    "location_name": "Kanpur, Uttar Pradesh, India",
    "gps_status": "SIMULATED",
    "is_live_gps": False
}


# --------------------------------------------------
# Shared State
# --------------------------------------------------

state_lock = threading.Lock()
camera_lock = threading.Lock()

camera = None
latest_sensors = {
    "temperature": 30.0,
    "humidity": 50.0,
    "gas": 20,
    "battery": 100,
    "timestamp": datetime.now().isoformat()
}

latest_camera_status = {
    "connected": False,
    "message": "Camera not started"
}

latest_detections = []
last_detection_time = {}

model = None

if YOLO is not None and os.path.exists(MODEL_PATH):
    try:
        model = YOLO(MODEL_PATH)
        print("YOLO model loaded:", MODEL_PATH)
    except Exception as error:
        print("YOLO model loading failed:", error)
else:
    print("YOLO model not loaded. Check model path and ultralytics.")


# --------------------------------------------------
# Database
# --------------------------------------------------

def get_db_connection():
    connection = sqlite3.connect(DB_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def init_database():
    with get_db_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS detections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                object_name TEXT NOT NULL,
                confidence REAL NOT NULL,
                timestamp TEXT NOT NULL
            )
        """)

    print("Database initialized:", DB_PATH)


def save_detection(object_name, confidence):
    timestamp = datetime.now().isoformat(timespec="seconds")

    with get_db_connection() as connection:
        connection.execute("""
            INSERT INTO detections (object_name, confidence, timestamp)
            VALUES (?, ?, ?)
        """, (object_name, float(confidence), timestamp))

    detection = {
        "object_name": object_name,
        "confidence": float(confidence),
        "timestamp": timestamp
    }

    with state_lock:
        latest_detections.insert(0, detection)
        del latest_detections[100:]

    return detection


# --------------------------------------------------
# Risk Assessment
# --------------------------------------------------

def calculate_risk(sensors):
    try:
        temperature = float(sensors.get("temperature", 0))
        gas = float(sensors.get("gas", 0))
    except (TypeError, ValueError):
        return "UNKNOWN"

    # Demonstration thresholds only; calibrate for real sensors.
    if temperature >= 60 or gas >= 90:
        return "CRITICAL"

    if temperature >= 45 or gas >= 70:
        return "HIGH"

    if temperature >= 35 or gas >= 50:
        return "MEDIUM"

    return "LOW"


# --------------------------------------------------
# Home API
# --------------------------------------------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "success": True,
        "message": "AI Search & Rescue Rover API is running",
        "endpoints": [
            "/api/location",
            "/api/status",
            "/api/sensors",
            "/api/predict-risk",
            "/api/detections",
            "/api/camera-status",
            "/api/camera",
            "/api/system"
        ]
    })


# --------------------------------------------------
# GPS LOCATION API
# --------------------------------------------------

@app.route("/api/location", methods=["GET"])
def get_location():
    return jsonify({
        "success": True,
        "latitude": GPS_DATA["latitude"],
        "longitude": GPS_DATA["longitude"],
        "location_name": GPS_DATA["location_name"],
        "gps_status": GPS_DATA["gps_status"],
        "is_live_gps": GPS_DATA["is_live_gps"],
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "map_url": (
            "https://www.google.com/maps?q="
            f"{GPS_DATA['latitude']},{GPS_DATA['longitude']}"
        )
    })


# --------------------------------------------------
# SENSOR API
# --------------------------------------------------

@app.route("/api/sensors", methods=["GET", "POST"])
def sensors_api():

    if request.method == "POST":
        data = request.get_json(silent=True)

        if not isinstance(data, dict):
            return jsonify({
                "success": False,
                "error": "Send sensor readings as a JSON object"
            }), 400

        allowed_fields = [
            "temperature",
            "humidity",
            "gas",
            "battery"
        ]

        updated_values = {}

        try:
            for field in allowed_fields:
                if field in data:
                    updated_values[field] = float(data[field])
        except (TypeError, ValueError):
            return jsonify({
                "success": False,
                "error": "Sensor values must be numeric"
            }), 400

        with state_lock:
            latest_sensors.update(updated_values)
            latest_sensors["timestamp"] = datetime.now().isoformat(
                timespec="seconds"
            )
            current = dict(latest_sensors)

        return jsonify({
            "success": True,
            "sensors": current,
            "risk": calculate_risk(current)
        })

    with state_lock:
        current = dict(latest_sensors)

    return jsonify({
        "success": True,
        "sensors": current,
        "risk": calculate_risk(current)
    })


# --------------------------------------------------
# RISK API
# --------------------------------------------------

@app.route("/api/predict-risk", methods=["GET", "POST"])
def predict_risk():

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
    else:
        with state_lock:
            data = dict(latest_sensors)

    return jsonify({
        "success": True,
        "risk": calculate_risk(data),
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "method": "rule-based demonstration"
    })


# --------------------------------------------------
# DETECTION HISTORY API
# --------------------------------------------------

@app.route("/api/detections", methods=["GET"])
def get_detections():

    limit = request.args.get("limit", default=20, type=int)
    limit = max(1, min(limit or 20, 100))

    try:
        with get_db_connection() as connection:
            rows = connection.execute("""
                SELECT id, object_name, confidence, timestamp
                FROM detections
                ORDER BY id DESC
                LIMIT ?
            """, (limit,)).fetchall()

        return jsonify({
            "success": True,
            "detections": [dict(row) for row in rows]
        })

    except sqlite3.Error as error:
        return jsonify({
            "success": False,
            "error": str(error),
            "detections": []
        }), 500


# --------------------------------------------------
# BACKEND STATUS API
# --------------------------------------------------

@app.route("/api/status", methods=["GET"])
def status():

    with state_lock:
        sensor_copy = dict(latest_sensors)
        camera_copy = dict(latest_camera_status)

    return jsonify({
        "success": True,
        "status": "online",
        "backend": "online",
        "camera": camera_copy,
        "sensors": sensor_copy,
        "risk": calculate_risk(sensor_copy),
        "gps_status": GPS_DATA["gps_status"],
        "timestamp": datetime.now().isoformat(timespec="seconds")
    })


# --------------------------------------------------
# CAMERA STATUS API
# --------------------------------------------------

@app.route("/api/camera-status", methods=["GET"])
def camera_status():

    with state_lock:
        result = dict(latest_camera_status)

    return jsonify(result)


# --------------------------------------------------
# CAMERA INITIALIZATION
# --------------------------------------------------

def get_camera():

    global camera

    with camera_lock:

        if camera is not None and camera.isOpened():
            return camera

        candidate = cv2.VideoCapture(0)

        if candidate.isOpened():
            camera = candidate

            with state_lock:
                latest_camera_status.update({
                    "connected": True,
                    "message": "USB camera connected"
                })

            return camera

        candidate.release()

        with state_lock:
            latest_camera_status.update({
                "connected": False,
                "message": "USB camera not available"
            })

        return None


# --------------------------------------------------
# LIVE CAMERA + YOLO DETECTION
# --------------------------------------------------

def generate_camera_frames():

    while True:

        cap = get_camera()

        if cap is None:
            break

        success, frame = cap.read()

        if not success:
            with state_lock:
                latest_camera_status.update({
                    "connected": False,
                    "message": "Unable to read camera frame"
                })
            break

        if model is not None:
            try:
                results = model(frame, verbose=False)

                for result in results:
                    for box in result.boxes:

                        class_id = int(box.cls[0].item())
                        confidence = float(box.conf[0].item())
                        object_name = model.names.get(
                            class_id, str(class_id)
                        )

                        name_lower = str(object_name).lower()

                        if name_lower in ("fire", "smoke"):
                            # Avoid inserting the same class every frame.
                            now = time.time()
                            previous = last_detection_time.get(
                                name_lower, 0
                            )

                            if confidence >= 0.50 and now - previous >= 5:
                                save_detection(object_name, confidence)
                                last_detection_time[name_lower] = now

                        x1, y1, x2, y2 = map(
                            int, box.xyxy[0].tolist()
                        )

                        label = (
                            f"{object_name} {confidence * 100:.1f}%"
                        )

                        cv2.rectangle(
                            frame,
                            (x1, y1),
                            (x2, y2),
                            (0, 200, 255),
                            2
                        )

                        cv2.putText(
                            frame,
                            label,
                            (x1, max(25, y1 - 8)),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            0.65,
                            (0, 200, 255),
                            2
                        )

                with state_lock:
                    latest_camera_status.update({
                        "connected": True,
                        "message": (
                            "Camera online; YOLO active"
                            if model is not None
                            else "Camera online; YOLO unavailable"
                        )
                    })

            except Exception as error:
                print("YOLO detection error:", error)

        ok, encoded = cv2.imencode(".jpg", frame)

        if not ok:
            continue

        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + encoded.tobytes()
            + b"\r\n"
        )


@app.route("/api/camera", methods=["GET"])
def camera_feed():

    return Response(
        generate_camera_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame"
    )


# --------------------------------------------------
# SYSTEM STATUS API
# --------------------------------------------------

@app.route("/api/system", methods=["GET"])
def system_status():

    with state_lock:
        sensor_copy = dict(latest_sensors)
        camera_copy = dict(latest_camera_status)

    return jsonify({
        "success": True,
        "backend": "online",
        "database": os.path.exists(DB_PATH),
        "yolo_loaded": model is not None,
        "camera": camera_copy,
        "gps_status": GPS_DATA["gps_status"],
        "risk": calculate_risk(sensor_copy),
        "timestamp": datetime.now().isoformat(timespec="seconds")
    })


# --------------------------------------------------
# START APPLICATION
# --------------------------------------------------

if __name__ == "__main__":

    init_database()

    print("=" * 50)
    print("AI SEARCH & RESCUE ROVER")
    print("Backend starting...")
    print("GPS API: http://127.0.0.1:5000/api/location")
    print("Camera API: http://127.0.0.1:5000/api/camera")
    print("=" * 50)

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        threaded=True
    )
