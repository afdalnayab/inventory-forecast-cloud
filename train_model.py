import pandas as pd
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

df = pd.read_csv("sales_data.csv")

le = LabelEncoder()
df["product_encoded"] = le.fit_transform(df["product"])

features = ["product_encoded", "day_of_year", "month", "day_of_week"]
X = df[features]
y = df["demand"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestRegressor(n_estimators=150, max_depth=10, random_state=42)
model.fit(X_train, y_train)

preds = model.predict(X_test)
mae = mean_absolute_error(y_test, preds)
print(f"Model trained. MAE: {mae:.2f} units")

joblib.dump(model, "model.pkl")
joblib.dump(le, "encoder.pkl")
print("Saved model.pkl and encoder.pkl")