from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from pathlib import Path

APP_DIR = Path(__file__).parent
DB_PATH = APP_DIR / "app_flask.db"

app = Flask(__name__)
CORS(app)

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        );
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS subscriptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            serviceName TEXT NOT NULL,
            amount REAL NOT NULL,
            startDate TEXT,
            endDate TEXT,
            manualRenewal INTEGER DEFAULT 0,
            autoRenewal INTEGER DEFAULT 0
        );
    """)
    conn.commit()
    conn.close()

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status":"ok"}), 200

# ---------- AUTH ----------
@app.route("/api/auth/register/", methods=["POST"])
def register():
    data = request.get_json(force=True)
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({"message":"name, email, and password are required"}), 400

    try:
        conn = get_db()
        cur = conn.cursor()
        cur.execute("INSERT INTO users (name, email, password) VALUES (?, ?, ?)", (name, email, password))
        conn.commit()
        user_id = cur.lastrowid
    except sqlite3.IntegrityError:
        return jsonify({"message":"Email already registered"}), 400
    finally:
        conn.close()

    return jsonify({"message":"Account created", "user":{"id":user_id,"name":name,"email":email}}), 201

@app.route("/api/auth/login/", methods=["POST"])
def login():
    data = request.get_json(force=True)
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"message":"email and password are required"}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT id, name, email FROM users WHERE email=? AND password=?", (email, password))
    row = cur.fetchone()
    conn.close()

    if not row:
        return jsonify({"message":"Invalid credentials"}), 401

    return jsonify({"message":"Login successful", "user":{"id":row["id"],"name":row["name"],"email":row["email"]}}), 200

# ---------- SUBSCRIPTIONS ----------
@app.route("/api/subscriptions/", methods=["GET"])
def list_subscriptions():
    conn = get_db()
    cur = conn.cursor()
    rows = cur.execute("SELECT id, serviceName, amount, startDate, endDate, manualRenewal, autoRenewal FROM subscriptions").fetchall()
    conn.close()
    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "serviceName": r["serviceName"],
            "amount": r["amount"],
            "startDate": r["startDate"],
            "endDate": r["endDate"],
            "manualRenewal": bool(r["manualRenewal"]),
            "autoRenewal": bool(r["autoRenewal"]),
        })
    return jsonify(items), 200

@app.route("/api/subscriptions/", methods=["POST"])
def create_subscription():
    data = request.get_json(force=True)
    required = ["serviceName","amount"]
    for k in required:
        if k not in data or data[k] in (None, ""):
            return jsonify({"message": f"{k} is required"}), 400

    serviceName = data.get("serviceName")
    amount = float(data.get("amount"))
    startDate = data.get("startDate")
    endDate = data.get("endDate")
    manualRenewal = 1 if data.get("manualRenewal") else 0
    autoRenewal = 1 if data.get("autoRenewal") else 0

    conn = get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO subscriptions (serviceName, amount, startDate, endDate, manualRenewal, autoRenewal)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (serviceName, amount, startDate, endDate, manualRenewal, autoRenewal))
    conn.commit()
    sub_id = cur.lastrowid
    conn.close()

    return jsonify({"message":"Subscription added","id":sub_id}), 201

@app.route("/api/subscriptions/<int:sub_id>/", methods=["DELETE"])
def delete_subscription(sub_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM subscriptions WHERE id=?", (sub_id,))
    if cur.rowcount == 0:
        conn.close()
        return jsonify({"message":"Not found"}), 404
    conn.commit()
    conn.close()
    return jsonify({"message":"Subscription deleted"}), 200


@app.route("/api/subscriptions/<int:sub_id>/", methods=["PUT", "PATCH"])
def update_subscription(sub_id):
    data = request.get_json(force=True) or {}
    # Only allow known fields; keep camelCase to match frontend
    allowed = ["serviceName", "amount", "startDate", "endDate", "manualRenewal", "autoRenewal"]
    fields = {k: data.get(k) for k in allowed if k in data}

    if not fields:
        return jsonify({"message":"No valid fields to update"}), 400

    # Build SQL dynamically
    sets = []
    values = []
    if "serviceName" in fields:
        sets.append("serviceName=?"); values.append(fields["serviceName"])
    if "amount" in fields:
        try:
            values.append(float(fields["amount"])); sets.append("amount=?")
        except (TypeError, ValueError):
            return jsonify({"message":"amount must be a number"}), 400
    if "startDate" in fields:
        sets.append("startDate=?"); values.append(fields["startDate"])
    if "endDate" in fields:
        sets.append("endDate=?"); values.append(fields["endDate"])
    if "manualRenewal" in fields:
        sets.append("manualRenewal=?"); values.append(1 if fields["manualRenewal"] else 0)
    if "autoRenewal" in fields:
        sets.append("autoRenewal=?"); values.append(1 if fields["autoRenewal"] else 0)

    if not sets:
        return jsonify({"message":"Nothing to update"}), 400

    conn = get_db()
    cur = conn.cursor()
    sql = "UPDATE subscriptions SET " + ", ".join(sets) + " WHERE id=?"
    values.append(sub_id)
    cur.execute(sql, tuple(values))
    conn.commit()
    updated = cur.execute("SELECT id, serviceName, amount, startDate, endDate, manualRenewal, autoRenewal FROM subscriptions WHERE id=?", (sub_id,)).fetchone()
    conn.close()
    if not updated:
        return jsonify({"message":"Not found"}), 404
    item = {
        "id": updated["id"],
        "serviceName": updated["serviceName"],
        "amount": updated["amount"],
        "startDate": updated["startDate"],
        "endDate": updated["endDate"],
        "manualRenewal": bool(updated["manualRenewal"]),
        "autoRenewal": bool(updated["autoRenewal"]),
    }
    return jsonify({"message":"Subscription updated", "item": item}), 200


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
