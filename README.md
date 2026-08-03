# 🌾 KrishiMool – Crop Price Prediction System

## 📁 Project Structure
```
krishimool/
├── app.py                  ← Flask backend (run this)
├── agmarknet_data.csv      ← 1800+ record Agmarknet-style dataset
├── requirements.txt        ← pip dependencies
├── templates/
│   └── index.html          ← Main UI (served by Flask)
├── static/
│   ├── css/styles.css
│   └── js/script.js
└── README.md
```

## 🚀 Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
source venv/bin/activate        # Mac/Linux
venv\Scripts\activate           # Windows

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run server
python app.py

# 4. Open browser
# → http://localhost:5000
```

## 🔌 API Endpoints

| Method | Endpoint             | Description              |
|--------|----------------------|--------------------------|
| POST   | /api/predict         | Predict crop price       |
| GET    | /api/stats           | Dataset statistics       |
| GET    | /api/market-prices   | Recent prices by crop    |

### POST /api/predict
```json
Request:  { "crop":"wheat", "state":"MH", "month":"3", "arrival":"250", "rainfall":"80", "temperature":"28" }
Response: { "success":true, "data": { "predicted":2310, "low":2148, "high":2472, "trend":"up", ... } }
```

## 📊 Dataset
- **1800+ records** across 14 crops × 12 states × Jan 2024–Mar 2026
- Columns: State, District, Market, Commodity, Arrival_Qty, Min_Price, Max_Price, Modal_Price, Date
- Data pattern matches Agmarknet (agmarknet.gov.in) format

## ✨ Features
- English + Marathi (मराठी) bilingual UI
- Dark / Light mode toggle
- 6-month Chart.js price trend
- MSP reference for all major crops
- Sell timing advice based on seasonal trend
- Arrival qty / rainfall / temperature factors in prediction
- Fully mobile responsive
