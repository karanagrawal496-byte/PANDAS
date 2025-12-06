import pandas as pd
from datetime import datetime
from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

# --- Initialize Flask App ---
app = Flask(__name__)   
# Enable CORS (Cross-Origin Resource Sharing)
# This lets your HTML/JS frontend talk to this Python backend
CORS(app)


# ---- Food Database (from your file) ----
foods = {
    'FoodName': [
        'Chicken Breast', 'White Rice', 'Broccoli', 'Peanut Butter', 'Banana',
        'Apple', 'Egg', 'Milk', 'Oats', 'Paneer',
        'Chapati', 'Dal', 'Almonds', 'Yogurt', 'Potato',
        'Tofu', 'Cheese', 'Fish', 'Bread', 'Pasta',
        'Olive Oil', 'Cucumber', 'Tomato', 'Orange', 'Honey'
    ],
    'StandardUnit': [
        '100g', 'serving', 'cup', 'tbsp', 'unit',
        'unit', 'unit', 'cup', 'cup', '100g',
        'piece', 'cup', '10 pieces', 'cup', '100g',
        '100g', 'slice', '100g', 'slice', 'cup',
        'tbsp', 'cup', 'unit', 'unit', 'tbsp'
    ],
    'StandardAmount': [
        100, 1, 91, 32, 1,
        1, 1, 240, 81, 100,
        1, 100, 10, 245, 100,
        100, 1, 100, 1, 100,
        14, 100, 1, 1, 21
    ],
    'Calories': [
        165, 205, 31, 188, 105,
        95, 78, 150, 150, 265,
        120, 130, 70, 100, 77,
        76, 113, 206, 80, 160,
        120, 16, 22, 62, 64
    ],
    'Protein': [
        31, 4.3, 2.6, 8, 1.3,
        0.5, 6.3, 8, 5, 18,
        3, 9, 3, 6, 2,
        8, 7, 22, 3, 5,
        0, 0.7, 1, 1.2, 0
    ],
    'Fat': [
        3.6, 0.4, 0.3, 16, 0.3,
        0.3, 5.3, 8, 3, 20,
        3.6, 1.2, 6, 3, 0.1,
        4.8, 9, 12, 1, 1,
        14, 0.1, 0.2, 0.2, 0
    ],
    'Carbs': [
        0, 45, 6, 7, 27,
        25, 0.6, 12, 27, 4,
        20, 18, 2, 12, 17,
        2, 0.4, 0, 14, 31,
        0, 3.6, 5, 15, 17
    ]
}
db_foods = pd.DataFrame(foods)
db_foods.set_index('FoodName', inplace=True)



log_daily = pd.DataFrame(columns=['Date', 'Time', 'Food', 'Amount', 'Unit', 'Calories', 'Protein', 'Fat', 'Carbs'])
targets = {'Calories': 2000, 'Protein': 150, 'Fat': 70, 'Carbs': 250}




# --- 1. Get Food Database ---
@app.route('/api/get_foods', methods=['GET'])
def get_foods():
    """Returns the full food database as JSON."""
    # Convert DataFrame to JSON in 'index' format { 'FoodName': {col: val, ...} }
    foods_json = db_foods.to_dict(orient='index')
    return jsonify(foods_json)

# --- 2. Get Targets ---
@app.route('/api/get_targets', methods=['GET'])
def get_targets():
    """Returns the current targets."""
    return jsonify(targets)

# --- 3. Set Targets ---
@app.route('/api/set_targets', methods=['POST'])
def set_targets():
    """Updates the targets from JSON data sent by the frontend."""
    global targets
    data = request.json  # Get the data { 'Calories': 2100, ... }
    try:
        # Update targets with new values
        targets['Calories'] = float(data.get('Calories', targets['Calories']))
        targets['Protein'] = float(data.get('Protein', targets['Protein']))
        targets['Fat'] = float(data.get('Fat', targets['Fat']))
        targets['Carbs'] = float(data.get('Carbs', targets['Carbs']))
        return jsonify({"message": "Targets updated successfully!", "targets": targets})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- 4. Log a Meal ---
@app.route('/api/log_meal', methods=['POST'])
def log_meal():
    """Logs a new meal entry from JSON data."""
    global log_daily
    data = request.json  # Get data { 'food_name': 'Apple', 'amount': 1 }

    try:
        food_name = data['food_name']
        amount = float(data['amount'])

        if food_name not in db_foods.index:
            return jsonify({"error": "Food not found"}), 404

        # Calculate macros (from your log_meal function)
        row = db_foods.loc[food_name]
        factor = amount / row['StandardAmount']
        cal = row['Calories'] * factor
        pro = row['Protein'] * factor
        fat = row['Fat'] * factor
        carb = row['Carbs'] * factor

        entry = {
            'Date': datetime.now().strftime("%Y-%m-%d"),
            'Time': datetime.now().strftime("%H:%M:%S"),
            'Food': food_name,
            'Amount': amount,
            'Unit': row['StandardUnit'],
            'Calories': cal,
            'Protein': pro,
            'Fat': fat,
            'Carbs': carb
        }
        
        # Use pd.concat to add the new row
        new_entry_df = pd.DataFrame([entry])
        log_daily = pd.concat([log_daily, new_entry_df], ignore_index=True)

        return jsonify({"message": f"Logged {cal:.0f} kcal from {food_name}!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# --- 5. Get Today's Summary ---
@app.route('/api/get_summary', methods=['GET'])
def get_summary():
    """Calculates and returns today's nutritional summary."""
    today = datetime.now().strftime("%Y-%m-%d")
    today_log = log_daily[log_daily['Date'] == today]

    if today_log.empty:
        totals = {'Calories': 0, 'Protein': 0, 'Fat': 0, 'Carbs': 0}
    else:
        totals = today_log[['Calories', 'Protein', 'Fat', 'Carbs']].sum().to_dict()

    # Convert the log entries for today to JSON
    logs_json = today_log.to_dict(orient='records')

    return jsonify({
        "totals": totals,
        "targets": targets,
        "logs": logs_json
    })
    

@app.route('/')
def index():
    """Serves the main HTML page."""
    # Flask will look for 'index.html' in a folder named 'templates'
    return render_template('index.html')


# --- Run the App ---
if __name__ == '__main__':
    # Setting host='0.0.0.0' makes it accessible on your network
    app.run(debug=True, host='0.0.0.0', port=5000)