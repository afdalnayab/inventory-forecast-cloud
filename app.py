import sqlite3
import os
from datetime import datetime, timedelta

import joblib
import numpy as np
from flask import Flask, jsonify, request, render_template, g

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(__file__), "inventory.db")
PRODUCT_LIST = ["Laptop", "Mouse", "Keyboard", "Monitor", "Headphones"]

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.pkl")
ENCODER_PATH = os.path.join(os.path.dirname(__file__), "encoder.pkl")
model = None
encoder = None
if os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH):
    model = joblib.load(MODEL_PATH)
    encoder = joblib.load(ENCODER_PATH)


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            stock_qty INTEGER NOT NULL,
            reorder_level INTEGER NOT NULL DEFAULT 20
        )
    """)
    count = db.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    if count == 0:
        seed = [
            ("Laptop", "Electronics", 40, 15),
            ("Mouse", "Accessories", 120, 30),
            ("Keyboard", "Accessories", 15, 25),
            ("Monitor", "Electronics", 8, 10),
            ("Headphones", "Accessories", 60, 20),
        ]
        db.executemany(
            "INSERT INTO products (name, category, stock_qty, reorder_level) VALUES (?, ?, ?, ?)",
            seed,
        )
        db.commit()
    db.close()


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/api/products", methods=["GET"])
def get_products():
    db = get_db()
    rows = db.execute("SELECT * FROM products").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/products", methods=["POST"])
def add_product():
    data = request.get_json()
    db = get_db()
    cur = db.execute(
        "INSERT INTO products (name, category, stock_qty, reorder_level) VALUES (?, ?, ?, ?)",
        (data["name"], data.get("category", ""), int(data["stock_qty"]), int(data.get("reorder_level", 20))),
    )
    db.commit()
    return jsonify({"id": cur.lastrowid, "message": "Product added"}), 201


@app.route("/api/products/<int:product_id>", methods=["PUT"])
def update_product(product_id):
    data = request.get_json()
    db = get_db()
    db.execute(
        "UPDATE products SET name=?, category=?, stock_qty=?, reorder_level=? WHERE id=?",
        (data["name"], data.get("category", ""), int(data["stock_qty"]), int(data.get("reorder_level", 20)), product_id),
    )
    db.commit()
    return jsonify({"message": "Product updated"})


@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def delete_product(product_id):
    db = get_db()
    db.execute("DELETE FROM products WHERE id=?", (product_id,))
    db.commit()
    return jsonify({"message": "Product deleted"})


@app.route("/api/lowstock", methods=["GET"])
def low_stock():
    db = get_db()
    rows = db.execute("SELECT * FROM products WHERE stock_qty <= reorder_level").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/forecast/<product_name>", methods=["GET"])
def forecast(product_name):
    if model is None:
        return jsonify({"error": "Model not trained yet. Run train_model.py first."}), 500
    if product_name not in encoder.classes_:
        return jsonify({"error": f"No trained data for product '{product_name}'"}), 400

    days_ahead = int(request.args.get("days", 7))
    product_encoded = encoder.transform([product_name])[0]

    today = datetime.now()
    predictions = []
    for i in range(1, days_ahead + 1):
        future_date = today + timedelta(days=i)
        features = np.array([[
            product_encoded,
            future_date.timetuple().tm_yday,
            future_date.month,
            future_date.weekday(),
        ]])
        pred = model.predict(features)[0]
        predictions.append({"date": future_date.strftime("%Y-%m-%d"), "predicted_demand": round(float(pred), 1)})

    total_predicted = round(sum(p["predicted_demand"] for p in predictions), 1)
    return jsonify({"product": product_name, "forecast": predictions, "total_predicted_demand": total_predicted})


@app.route("/api/products/list-names", methods=["GET"])
def list_product_names():
    return jsonify(PRODUCT_LIST)


if __name__ == "__main__":
    init_db()
    app.run(debug=True, host="0.0.0.0", port=5000)
