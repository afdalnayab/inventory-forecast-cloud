import pandas as pd
import numpy as np

np.random.seed(42)

products = ["Laptop", "Mouse", "Keyboard", "Monitor", "Headphones"]
start_date = pd.to_datetime("2023-01-01")
days = 730

rows = []
for product in products:
    base_demand = np.random.randint(15, 60)
    for d in range(days):
        date = start_date + pd.Timedelta(days=d)
        day_of_year = date.dayofyear
        month = date.month
        day_of_week = date.dayofweek

        seasonal_boost = 1.4 if month in [10, 11, 12] else 1.0
        weekend_boost = 1.2 if day_of_week in [5, 6] else 1.0
        trend = 1 + (d / days) * 0.3
        noise = np.random.normal(0, 5)
        demand = max(0, int(base_demand * seasonal_boost * weekend_boost * trend + noise))

        rows.append([date.strftime("%Y-%m-%d"), product, day_of_year, month, day_of_week, demand])

df = pd.DataFrame(rows, columns=["date", "product", "day_of_year", "month", "day_of_week", "demand"])
df.to_csv("sales_data.csv", index=False)
print(f"sales_data.csv created with {len(df)} rows")
