import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import os

print("Loading dataset...")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE_DIR, 'agmarknet_data.csv')

# 1. Load Data
df = pd.read_csv(CSV_PATH)
df.columns = df.columns.str.strip()

# 2. Preprocess Data
print("Preprocessing data...")
df['Date'] = pd.to_datetime(df['Date'], dayfirst=False, errors='coerce')
df = df.dropna(subset=['Date'])
df['Month'] = df['Date'].dt.month
df['Year'] = df['Date'].dt.year

# Clean text columns
df['Commodity'] = df['Commodity'].str.strip()
df['State'] = df['State'].str.strip()

# Select features for prediction
# We will use: State, Commodity, Month, Arrival_Qty
# Target: Modal_Price
features = ['State', 'Commodity', 'Month', 'Arrival_Qty']
target = 'Modal_Price'

df_ml = df.dropna(subset=features + [target]).copy()

# Encode Categorical Variables (State and Commodity)
le_state = LabelEncoder()
le_commodity = LabelEncoder()

df_ml['State_Encoded'] = le_state.fit_transform(df_ml['State'])
df_ml['Commodity_Encoded'] = le_commodity.fit_transform(df_ml['Commodity'])

X = df_ml[['State_Encoded', 'Commodity_Encoded', 'Month', 'Arrival_Qty']]
y = df_ml[target]

# 3. Train/Test Split
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# 4. Train Model
print("Training Random Forest Model...")
model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# 5. Evaluate Model
predictions = model.predict(X_test)
mae = mean_absolute_error(y_test, predictions)
r2 = r2_score(y_test, predictions)
print("Model Performance:")
print(f"   - Mean Absolute Error (MAE): Rs. {mae:.2f}")
print(f"   - R-squared Score: {r2:.2f}")

# 6. Save Model and Encoders
print("Saving model and encoders...")
joblib.dump(model, os.path.join(BASE_DIR, 'rf_price_model.pkl'))
joblib.dump(le_state, os.path.join(BASE_DIR, 'le_state.pkl'))
joblib.dump(le_commodity, os.path.join(BASE_DIR, 'le_commodity.pkl'))

print("Done! You can now use 'rf_price_model.pkl' for predictions in app.py")
