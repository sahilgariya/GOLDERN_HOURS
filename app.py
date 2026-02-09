# app.py
# Main Flask backend
from flask import Flask, render_template, jsonify, request
import sqlite3
from datetime import datetime, timedelta
import random

app = Flask(__name__)

DB = "database.db"

# ---------------- DATABASE SETUP ----------------
def init_db():
    with sqlite3.connect(DB) as conn:
        c = conn.cursor()
        c.execute("""
        CREATE TABLE IF NOT EXISTS daily (
            date TEXT PRIMARY KEY,
            start_time TEXT,
            golden_start TEXT,
            golden_end TEXT,
            notified INTEGER
        )
        """)
        conn.commit()

# ---------------- DAILY LOGIC ----------------
def get_today():
    return datetime.now().strftime("%Y-%m-%d")

def get_data():
    today = get_today()
    with sqlite3.connect(DB) as conn:
        c = conn.cursor()
        c.execute("SELECT * FROM daily WHERE date=?", (today,))
        row = c.fetchone()

        if not row:
            # Generate random Golden Hour
            start_hour = random.randint(0, 23)
            start_minute = random.randint(0, 59)

            golden_start = datetime.now().replace(
                hour=start_hour, minute=start_minute, second=0
            )
            golden_end = golden_start + timedelta(hours=1)

            c.execute("""
            INSERT INTO daily VALUES (?, ?, ?, ?, ?)
            """, (today, None,
                  golden_start.isoformat(),
                  golden_end.isoformat(),
                  0))
            conn.commit()

            return get_data()

        return row

# ---------------- ROUTES ----------------
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/start", methods=["POST"])
def start_timer():
    today = get_today()
    now = datetime.now().isoformat()

    with sqlite3.connect(DB) as conn:
        c = conn.cursor()
        c.execute("UPDATE daily SET start_time=? WHERE date=? AND start_time IS NULL",
                  (now, today))
        conn.commit()

    return jsonify({"status": "started"})

@app.route("/status")
def status():
    data = get_data()

    _, start_time, golden_start, golden_end, notified = data
    now = datetime.now()

    started = start_time is not None
    elapsed = 0

    if started:
        elapsed = int((now - datetime.fromisoformat(start_time)).total_seconds())

    golden_active = (
        datetime.fromisoformat(golden_start)
        <= now
        <= datetime.fromisoformat(golden_end)
    )

    # Trigger notification once
    if golden_active and not notified:
        with sqlite3.connect(DB) as conn:
            c = conn.cursor()
            c.execute("UPDATE daily SET notified=1 WHERE date=?", (get_today(),))
            conn.commit()

    return jsonify({
        "started": started,
        "elapsed": elapsed,
        "golden": golden_active
    })

# ---------------- RUN APP ----------------
if __name__ == "__main__":
    init_db()
    app.run(debug=True)
