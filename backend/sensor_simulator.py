import requests
import random
import time

API_URL = "http://127.0.0.1:5000/api/sensors"

while True:

    temperature = round(random.uniform(28, 40), 1)
    humidity = random.randint(45, 75)
    gas = random.randint(10, 90)
    battery = random.randint(70, 100)

    data = {
        "temperature": temperature,
        "humidity": humidity,
        "gas": gas,
        "battery": battery
    }

    try:
        response = requests.post(
            API_URL,
            json=data
        )

        result = response.json()

        print(
            f"Temperature: {temperature}°C | "
            f"Humidity: {humidity}% | "
            f"Gas: {gas} | "
            f"Battery: {battery}% | "
            f"AI Risk: {result['risk_level']}"
        )

    except Exception as error:
        print("Backend connection error:", error)

    time.sleep(3)