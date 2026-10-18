
#define ENA 5
#define IN1 22
#define IN2 23
#define IN3 24
#define IN4 25
#define ENB 6

#define TRIG 30
#define ECHO 31
#define DHTPIN 32

const int MOTOR_SPEED = 160;
const float STOP_DISTANCE = 20.0;

char currentCommand = 'S';
unsigned long lastSensorRead = 0;
float distanceCM = -1;
float temperatureC = -1;
float humidityPercent = -1;

void stopMotors() {
  analogWrite(ENA, 0);
  analogWrite(ENB, 0);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, LOW);
}

float readDistance() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(3);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  unsigned long duration = pulseIn(ECHO, HIGH, 30000UL);

  if (duration == 0) return -1;
  return duration * 0.0343 / 2.0;
}

bool readDHT11(float &humidity, float &temperature) {
  byte data[5] = {0, 0, 0, 0, 0};

  pinMode(DHTPIN, OUTPUT);
  digitalWrite(DHTPIN, LOW);
  delay(20);
  digitalWrite(DHTPIN, HIGH);
  delayMicroseconds(30);
  pinMode(DHTPIN, INPUT_PULLUP);

  if (pulseIn(DHTPIN, LOW, 100) == 0) return false;
  if (pulseIn(DHTPIN, HIGH, 100) == 0) return false;
  if (pulseIn(DHTPIN, LOW, 100) == 0) return false;

  for (byte i = 0; i < 40; i++) {
    unsigned long lowTime = pulseIn(DHTPIN, LOW, 100);
    unsigned long highTime = pulseIn(DHTPIN, HIGH, 100);

    if (lowTime == 0 || highTime == 0) return false;

    data[i / 8] <<= 1;
    if (highTime > 40) {
      data[i / 8] |= 1;
    }
  }

  if ((byte)(data[0] + data[1] + data[2] + data[3]) != data[4]) {
    return false;
  }

  humidity = data[0] + data[1] * 0.1;
  temperature = data[2] + data[3] * 0.1;

  return true;
}

void moveForward() {
  if (distanceCM > 0 && distanceCM <= STOP_DISTANCE) {
    stopMotors();
    Serial.println("OBSTACLE:STOP");
    return;
  }

  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  analogWrite(ENA, MOTOR_SPEED);
  analogWrite(ENB, MOTOR_SPEED);
}

void moveBackward() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  analogWrite(ENA, MOTOR_SPEED);
  analogWrite(ENB, MOTOR_SPEED);
}

void turnLeft() {
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, HIGH);
  digitalWrite(IN3, HIGH);
  digitalWrite(IN4, LOW);
  analogWrite(ENA, MOTOR_SPEED);
  analogWrite(ENB, MOTOR_SPEED);
}

void turnRight() {
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  analogWrite(ENA, MOTOR_SPEED);
  analogWrite(ENB, MOTOR_SPEED);
}

void handleCommand(char command) {
  currentCommand = command;

  switch (command) {
    case 'F': moveForward(); break;
    case 'B': moveBackward(); break;
    case 'L': turnLeft(); break;
    case 'R': turnRight(); break;
    case 'S': stopMotors(); break;
  }
}

void readSensors() {
  distanceCM = readDistance();

  float h, t;
  if (readDHT11(h, t)) {
    humidityPercent = h;
    temperatureC = t;
  }

  Serial.print("DISTANCE:");
  Serial.println(distanceCM);

  Serial.print("TEMPERATURE:");
  Serial.println(temperatureC);

  Serial.print("HUMIDITY:");
  Serial.println(humidityPercent);

  if (currentCommand == 'F' &&
      distanceCM > 0 &&
      distanceCM <= STOP_DISTANCE) {
    stopMotors();
    currentCommand = 'S';
    Serial.println("OBSTACLE:STOP");
  }
}

void setup() {
  Serial.begin(9600);

  pinMode(ENA, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  pinMode(ENB, OUTPUT);

  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(DHTPIN, INPUT_PULLUP);

  stopMotors();
  Serial.println("RESCUE_ROVER_READY");
}

void loop() {
  while (Serial.available() > 0) {
    char command = Serial.read();

    if (command >= 'a' && command <= 'z') {
      command -= 32;
    }

    if (command == 'F' || command == 'B' ||
        command == 'L' || command == 'R' ||
        command == 'S') {
      handleCommand(command);
    }
  }

  if (millis() - lastSensorRead >= 2000) {
    lastSensorRead = millis();
    readSensors();
  }
}
