import cv2
import time
import requests
from ultralytics import YOLO

MODEL_NAME = "yolo11n.pt"
API_URL = "http://127.0.0.1:5000/api/detections"

model = YOLO(MODEL_NAME)

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    print("Camera open nahi ho raha.")
    exit()

print("YOLO Camera Started")
print("Press Q to quit")

last_saved = {}

while True:

    ret, frame = cap.read()

    if not ret:
        print("Camera frame receive nahi hua.")
        break

    results = model(
        frame,
        conf=0.25,
        imgsz=640,
        device="cpu",
        verbose=False
    )

    current_time = time.time()

    for result in results:

        for box in result.boxes:

            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            object_name = model.names[class_id]

            x1, y1, x2, y2 = map(
                int,
                box.xyxy[0]
            )

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            label = f"{object_name} {confidence:.2f}"

            cv2.putText(
                frame,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

            # Save detection once every 3 seconds
            if object_name not in last_saved or current_time - last_saved[object_name] > 3:

                data = {
                    "object_name": object_name,
                    "confidence": round(confidence, 3)
                }

                try:
                    requests.post(
                        API_URL,
                        json=data,
                        timeout=2
                    )

                    print(
                        f"Detected: {object_name} "
                        f"| Confidence: {confidence:.2f}"
                    )

                    last_saved[object_name] = current_time

                except Exception as error:
                    print(
                        "Flask connection error:",
                        error
                    )

    cv2.imshow(
        "AI Search & Rescue - YOLO Detection",
        frame
    )

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break


cap.release()
cv2.destroyAllWindows()

print("YOLO Camera Stopped")