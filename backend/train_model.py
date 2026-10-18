import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib

data = []

for temperature in range(25, 46):
    for humidity in range(40, 81, 5):
        for gas in range(5, 101, 5):
            battery = 90

            if gas >= 75 or temperature >= 38:
                risk = "CRITICAL"
            elif gas >= 55 or temperature >= 35:
                risk = "HIGH"
            elif gas >= 35 or temperature >= 32:
                risk = "MEDIUM"
            else:
                risk = "LOW"

            data.append([
                temperature,
                humidity,
                gas,
                battery,
                risk
            ])

df = pd.DataFrame(
    data,
    columns=[
        "temperature",
        "humidity",
        "gas",
        "battery",
        "risk"
    ]
)

X = df[
    [
        "temperature",
        "humidity",
        "gas",
        "battery"
    ]
]

y = df["risk"]

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42
)

model.fit(X_train, y_train)

predictions = model.predict(X_test)

accuracy = accuracy_score(y_test, predictions)

print("Model Accuracy:", round(accuracy * 100, 2), "%")

joblib.dump(model, "risk_model.pkl")

print("Model saved as risk_model.pkl")