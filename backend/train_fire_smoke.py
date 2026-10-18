from ultralytics import YOLO


MODEL_PATH = "runs/detect/runs/fire_smoke-4/weights/last.pt"


model = YOLO(MODEL_PATH)


model.train(
    resume=True
)


print("Training completed successfully!")