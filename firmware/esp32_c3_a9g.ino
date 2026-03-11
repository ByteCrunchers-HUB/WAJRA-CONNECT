#include <WiFi.h>
#include <HTTPClient.h>

// --- Configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://YOUR_BACKEND_IP:5000/api/iot/location";
const char* apiKey = "WajraConnect-device-key";

// Pins for A9G Communication (UART)
#define A9G_TX 18
#define A9G_RX 19
#define SOS_BUTTON_PIN 5

HardwareSerial SerialA9G(1);

void setup() {
  Serial.begin(115200);
  SerialA9G.begin(115200, SERIAL_8N1, A9G_RX, A9G_TX);
  
  pinMode(SOS_BUTTON_PIN, INPUT_PULLUP);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Connected");

  // Initial A9G setup
  sendATCommand("AT+GPS=1", 1000); // Turn on GPS
}

void loop() {
  // 1. Read GPS from A9G
  String gpsData = getGPSLocation();
  
  // 2. Check SOS Button
  bool sosTriggered = (digitalRead(SOS_BUTTON_PIN) == LOW);

  // 3. Send to Backend
  if (WiFi.status() == WL_CONNECTED) {
    sendDataToBackend(gpsData, sosTriggered);
  }

  delay(10000); // 10 second update interval
}

String getGPSLocation() {
    SerialA9G.println("AT+LOCATION=2"); // Get GPS coordinates
    String response = "";
    long timeout = millis() + 2000;
    while (millis() < timeout) {
        if (SerialA9G.available()) response += SerialA9G.readString();
    }
    return response;
}

void sendDataToBackend(String gpsRaw, bool sos) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", apiKey);

    // Parse lat/lng from A9G response (simplified)
    // Real parsing logic would go here based on A9G output format
    float lat = 28.6139; // Default placeholder
    float lng = 77.2090;

    String jsonPayload = "{\"lat\":" + String(lat, 6) + 
                         ", \"lng\":" + String(lng, 6) + 
                         ", \"sos\":" + (sos ? "true" : "false") + 
                         ", \"battery\": 85}";

    int httpCode = http.POST(jsonPayload);
    if (httpCode > 0) {
      Serial.printf("[HTTP] POST... code: %d\n", httpCode);
    }
    http.end();
}

void sendATCommand(String cmd, int wait) {
    SerialA9G.println(cmd);
    delay(wait);
}
