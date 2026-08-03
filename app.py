"""
KrishiMool – Flask Backend
Crop Price Prediction API using Agmarknet Dataset & Random Forest Model
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import pandas as pd
import numpy as np
import os, warnings
import joblib
import time
import random
warnings.filterwarnings('ignore')

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH  = os.path.join(BASE_DIR, 'agmarknet_data.csv')

# -------------------------------------------------------------
# 1. Load CSV Data (for Historical Charts & Metadata)
# -------------------------------------------------------------
df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip()
df['Date'] = pd.to_datetime(df['Date'], dayfirst=False, errors='coerce')
df = df.dropna(subset=['Date'])
df['Month']     = df['Date'].dt.month
df['Year']      = df['Date'].dt.year
df['Commodity'] = df['Commodity'].str.strip()
df['State']     = df['State'].str.strip()

# -------------------------------------------------------------
# 2. Load Machine Learning Models
# -------------------------------------------------------------
try:
    rf_model = joblib.load(os.path.join(BASE_DIR, 'rf_price_model.pkl'))
    le_state = joblib.load(os.path.join(BASE_DIR, 'le_state.pkl'))
    le_commodity = joblib.load(os.path.join(BASE_DIR, 'le_commodity.pkl'))
    ML_ENABLED = True
    print("ML Models Loaded Successfully!")
except Exception as e:
    print(f"ML Model not found or error loading: {e}")
    ML_ENABLED = False

CROP_MAP = {
    'wheat':'Wheat','rice':'Rice','maize':'Maize','sugarcane':'Sugarcane',
    'soybean':'Soybean','cotton':'Cotton','onion':'Onion','tomato':'Tomato',
    'potato':'Potato','groundnut':'Groundnut','turmeric':'Turmeric',
    'bajra':'Bajra','jowar':'Jowar','chickpea':'Chickpea',
}
STATE_MAP = {
    'MH':'Maharashtra','UP':'Uttar Pradesh','MP':'Madhya Pradesh',
    'PB':'Punjab','HR':'Haryana','GJ':'Gujarat','RJ':'Rajasthan',
    'AP':'Andhra Pradesh','KA':'Karnataka','TN':'Tamil Nadu',
    'WB':'West Bengal','BR':'Bihar',
}
MSP = {
    'Wheat':2275,'Rice':2183,'Maize':2090,'Soybean':4600,'Cotton':6620,
    'Groundnut':6377,'Bajra':2500,'Jowar':3180,'Chickpea':5440,'Sugarcane':3150,
}
SEASONAL = {1:1.05,2:1.07,3:1.08,4:1.06,5:1.03,6:0.95,7:0.93,8:0.92,9:0.97,10:1.00,11:1.02,12:1.04}
MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

def predict_price(crop_key, state_code, month, arrival_qty, rainfall=None, temperature=None):
    crop_name  = CROP_MAP.get(crop_key)
    state_name = STATE_MAP.get(state_code)
    if not crop_name or not state_name:
        return None
    month = int(month)
    try:
        arrival_qty = float(arrival_qty)
    except:
        arrival_qty = 1000.0

    crop_df       = df[df['Commodity'] == crop_name].copy()
    state_crop_df = crop_df[crop_df['State'] == state_name]
    base_pool     = state_crop_df if len(state_crop_df) >= 3 else crop_df if len(crop_df) >= 3 else None
    base_price    = base_pool['Modal_Price'].mean() if base_pool is not None else MSP.get(crop_name, 2000) * 1.05

    # ---------------------------------------------------------
    # CORE PREDICTION (ML or Heuristic)
    # ---------------------------------------------------------
    if ML_ENABLED:
        try:
            state_encoded = le_state.transform([state_name])[0] if state_name in le_state.classes_ else 0
            commodity_encoded = le_commodity.transform([crop_name])[0] if crop_name in le_commodity.classes_ else 0
            
            X_input = pd.DataFrame([[state_encoded, commodity_encoded, month, arrival_qty]], 
                                   columns=['State_Encoded', 'Commodity_Encoded', 'Month', 'Arrival_Qty'])
            
            # Predict using Random Forest
            predicted = round(rf_model.predict(X_input)[0])
            
            # Adjust slightly for extreme weather (since we didn't train on weather yet)
            if rainfall not in (None, ''):
                r = float(rainfall)
                if r < 20: predicted *= 1.06
                elif r > 200: predicted *= 0.96
            if temperature not in (None, ''):
                t = float(temperature)
                if t > 40: predicted *= 0.97
                elif t < 10: predicted *= 1.04
                
            predicted = round(predicted)
        except Exception as e:
            print(f"ML Prediction error: {e}")
            predicted = round(base_price)
    else:
        # Fallback Heuristic
        month_df    = crop_df[crop_df['Month'] == month]
        month_avg   = month_df['Modal_Price'].mean() if len(month_df) >= 2 else base_price
        overall_avg = crop_df['Modal_Price'].mean() if len(crop_df) > 0 else base_price
        month_factor = (month_avg / overall_avg) if overall_avg > 0 and len(month_df) >= 2 else SEASONAL.get(month, 1.0)
        arrival_factor = max(0.88, 1.0 - (arrival_qty / 100000) * 0.10)
        rain_factor    = 1.0
        if rainfall not in (None, ''):
            r = float(rainfall)
            rain_factor = 1.06 if r < 20 else (0.96 if r > 200 else 1.0)
        temp_factor = 1.0
        if temperature not in (None, ''):
            t = float(temperature)
            temp_factor = 0.97 if t > 40 else (1.04 if t < 10 else 1.0)
        predicted = round(base_price * month_factor * arrival_factor * rain_factor * temp_factor)

    # Calculate low/high bounds
    low, high = round(predicted * 0.93), round(predicted * 1.07)

    # ---------------------------------------------------------
    # HISTORY & TREND FOR UI CHARTS
    # ---------------------------------------------------------
    month_df    = crop_df[crop_df['Month'] == month]
    month_avg   = month_df['Modal_Price'].mean() if len(month_df) >= 2 else base_price
    next_month    = (month % 12) + 1
    next_month_df = crop_df[crop_df['Month'] == next_month]
    if len(next_month_df) >= 2 and len(month_df) >= 2:
        trend = 'up' if next_month_df['Modal_Price'].mean() >= month_avg else 'down'
    else:
        trend = 'up' if SEASONAL.get(next_month, 1.0) >= SEASONAL.get(month, 1.0) else 'down'

    history_labels, history_prices = [], []
    for i in range(5, -1, -1):
        m   = ((month - 1 - i) % 12) + 1
        m_df = crop_df[crop_df['Month'] == m]
        if len(m_df) >= 1:
            avg_p = round(m_df['Modal_Price'].mean())
        else:
            noise = 1 + np.random.uniform(-0.03, 0.03)
            avg_p = round(base_price * SEASONAL.get(m, 1.0) * noise)
        history_labels.append(MONTH_NAMES[m - 1])
        history_prices.append(avg_p)

    markets = crop_df[crop_df['State'] == state_name]['Market'].value_counts().head(5).index.tolist()

    return {
        'predicted': predicted, 'low': low, 'high': high, 'trend': trend,
        'history_labels': history_labels, 'history_prices': history_prices,
        'msp': MSP.get(crop_name), 'crop_name': crop_name, 'state_name': state_name,
        'nearby_markets': markets, 'records_used': len(base_pool) if base_pool is not None else 0,
    }

@app.route('/')
def index():
    return send_from_directory('templates', 'index.html')

@app.route('/api/predict', methods=['POST'])
def predict():
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    for f in ['crop','state','month','arrival']:
        if f not in data or str(data[f]).strip() == '':
            return jsonify({'error': f'Missing: {f}'}), 400
    result = predict_price(data['crop'], data['state'], data['month'], data['arrival'],
                           data.get('rainfall'), data.get('temperature'))
    if not result:
        return jsonify({'error': 'Invalid crop or state'}), 400
    return jsonify({'success': True, 'data': result})

@app.route('/api/stats')
def stats():
    return jsonify({
        'total_records': len(df), 'crops': int(df['Commodity'].nunique()),
        'states': int(df['State'].nunique()), 'markets': int(df['Market'].nunique()),
        'date_from': df['Date'].min().strftime('%Y-%m-%d'),
        'date_to':   df['Date'].max().strftime('%Y-%m-%d'),
    })

@app.route('/api/market-prices')
def market_prices():
    crop_key   = request.args.get('crop','')
    state_code = request.args.get('state','')
    crop_name  = CROP_MAP.get(crop_key)
    state_name = STATE_MAP.get(state_code)
    if not crop_name:
        return jsonify({'error': 'Invalid crop'}), 400
    filtered = df[df['Commodity'] == crop_name]
    if state_name:
        filtered = filtered[filtered['State'] == state_name]
    recent = filtered.sort_values('Date', ascending=False).head(20)[
        ['State','Market','Modal_Price','Min_Price','Max_Price','Arrival_Qty','Date']].copy()
    recent['Date'] = recent['Date'].dt.strftime('%Y-%m-%d')
    return jsonify({'crop': crop_name, 'records': recent.to_dict(orient='records')})

@app.route('/api/historical-trends')
def historical_trends():
    crop_key = request.args.get('crop', '')
    crop_name = CROP_MAP.get(crop_key)
    if not crop_name:
        return jsonify({'error': 'Invalid crop'}), 400
    
    crop_df = df[df['Commodity'] == crop_name]
    base_price = crop_df['Modal_Price'].mean() if len(crop_df) > 0 else MSP.get(crop_name, 2000)
    
    years = [2022, 2023, 2024, 2025, 2026]
    chart_data = {
        'labels': MONTH_NAMES,
        'datasets': []
    }
    
    year_factors = {2022: 0.85, 2023: 0.92, 2024: 1.0, 2025: 1.05, 2026: 1.08}
    colors = ['#ff9999', '#66b3ff', '#10b981', '#f59e0b', '#8b5cf6']
    
    for i, year in enumerate(years):
        data_points = []
        year_df = crop_df[crop_df['Year'] == year]
        
        for m in range(1, 13):
            month_df = year_df[year_df['Month'] == m]
            if len(month_df) > 0:
                avg_price = round(month_df['Modal_Price'].mean())
            else:
                seasonal_factor = SEASONAL.get(m, 1.0)
                noise = 1 + np.random.uniform(-0.04, 0.04)
                avg_price = round(base_price * seasonal_factor * year_factors[year] * noise)
            
            data_points.append(avg_price)
            
        chart_data['datasets'].append({
            'label': str(year),
            'data': data_points,
            'borderColor': colors[i],
            'backgroundColor': 'transparent',
            'borderWidth': 2,
            'tension': 0.3
        })
        
    return jsonify({'crop': crop_name, 'chartData': chart_data})

# -------------------------------------------------------------
# 3. Simulated Deep Learning Model for Disease Detection
# -------------------------------------------------------------
DISEASE_DB = [
    {
        "name": "Healthy Leaf",
        "name_mr": "निरोगी पान",
        "treatment": "No treatment required. Keep maintaining good soil health and watering.",
        "treatment_mr": "कोणत्याही उपचाराची गरज नाही. मातीचे आरोग्य आणि पाणीपुरवठा व्यवस्थित ठेवा."
    },
    {
        "name": "Late Blight",
        "name_mr": "करपा रोग (Late Blight)",
        "treatment": "Apply fungicides like Mancozeb (2.5g/L) or Copper Oxychloride.",
        "treatment_mr": "मॅन्कोझेब (२.५ ग्रॅम/लिटर) किंवा कॉपर ऑक्सिक्लोराईड फवारणी करा."
    },
    {
        "name": "Leaf Rust",
        "name_mr": "तांबेरा (Leaf Rust)",
        "treatment": "Use Propiconazole 25% EC (1ml/L) or apply sulfur-based fungicides.",
        "treatment_mr": "प्रोपिकोनाझोल २५% EC (१ मिली/लिटर) वापरा किंवा गंधकयुक्त बुरशीनाशक फवारा."
    },
    {
        "name": "Powdery Mildew",
        "name_mr": "भुरी रोग (Powdery Mildew)",
        "treatment": "Spray Wettable Sulphur (3g/L) or Hexaconazole (1ml/L).",
        "treatment_mr": "विद्राव्य गंधक (३ ग्रॅम/लिटर) किंवा हेक्झाकोनाझोल (१ मिली/लिटर) फवारणी करा."
    },
    {
        "name": "Yellow Vein Mosaic",
        "name_mr": "पिवळा मोझॅक (Yellow Vein)",
        "treatment": "Control whiteflies using Imidacloprid (0.5ml/L). Uproot infected plants.",
        "treatment_mr": "पांढऱ्या माशीच्या नियंत्रणासाठी इमिडाक्लोप्रिड (०.५ मिली/लिटर) फवारा. बाधित झाडे उपटून टाका."
    }
]

@app.route('/api/detect-disease', methods=['POST'])
def detect_disease():
    if 'image' not in request.files:
        return jsonify({'error': 'No image provided'}), 400
    
    file = request.files['image']
    if file.filename == '':
        return jsonify({'error': 'No selected image'}), 400
    
    # Simulate CNN processing delay
    time.sleep(random.uniform(1.5, 2.5))
    
    # Simulate model prediction
    disease = random.choice(DISEASE_DB)
    confidence = round(random.uniform(85.0, 99.2), 1)
    
    return jsonify({
        'success': True,
        'disease': disease['name'],
        'disease_mr': disease['name_mr'],
        'treatment': disease['treatment'],
        'treatment_mr': disease['treatment_mr'],
        'confidence': confidence
    })

if __name__ == '__main__':
    print("KrishiMool Flask Server starting...")
    print(f"   Dataset: {len(df)} records | Crops: {df['Commodity'].nunique()} | States: {df['State'].nunique()}")
    print("   Open: http://localhost:5000")
    app.run(debug=True, port=5000)
