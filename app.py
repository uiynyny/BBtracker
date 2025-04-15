import os
import logging
from flask import Flask, render_template, jsonify, request, redirect, url_for, flash

# Initialize Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-secret-key")

# Configure PostgreSQL database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Import and initialize SQLAlchemy with our app
from database import db
db.init_app(app)

# Import models after db is defined to avoid circular imports
from models import ProductSnapshot

# Initialize database tables within application context
with app.app_context():
    db.create_all()
    print("Database tables created successfully.")

# Initialize scheduler but start it after all routes are defined
# to avoid circular import issues
def initialize_scheduler():
    from scheduler import start_scheduler
    return start_scheduler()

@app.route('/')
def index():
    """Render the main monitoring page."""
    return render_template('index.html')

@app.route('/history')
def history():
    """Render the history page with all recorded snapshots."""
    return render_template('history.html')

@app.route('/api/current')
def get_current():
    """Return the most recent product snapshot."""
    from sqlalchemy import desc
    latest_snapshot = ProductSnapshot.query.order_by(desc(ProductSnapshot.timestamp)).first()
    
    if not latest_snapshot:
        return jsonify({"error": "No data available yet"}), 404
    
    # Return the most recent snapshot
    return jsonify(latest_snapshot.to_dict())

@app.route('/api/history')
def get_history():
    """Return all product snapshots."""
    from sqlalchemy import asc
    snapshots = ProductSnapshot.query.order_by(asc(ProductSnapshot.timestamp)).all()
    
    if not snapshots:
        return jsonify({"error": "No data available yet"}), 404
    
    return jsonify([snapshot.to_dict() for snapshot in snapshots])

@app.route('/api/force-refresh', methods=['POST'])
def force_refresh():
    """Force a refresh of the product data."""
    from scraper import scrape_product
    
    try:
        new_snapshot = scrape_product()
        if new_snapshot:
            flash('Product data refreshed successfully', 'success')
            return jsonify({"status": "success", "data": new_snapshot})
        else:
            flash('Failed to refresh product data', 'danger')
            return jsonify({"status": "error", "message": "Failed to fetch product data"}), 500
    except Exception as e:
        logging.error(f"Error during forced refresh: {str(e)}")
        flash(f'Error during refresh: {str(e)}', 'danger')
        return jsonify({"status": "error", "message": str(e)}), 500

@app.errorhandler(404)
def page_not_found(e):
    """Handle 404 errors."""
    return render_template('index.html', error="Page not found"), 404

@app.errorhandler(500)
def server_error(e):
    """Handle 500 errors."""
    return render_template('index.html', error="Server error occurred"), 500

# Start scheduler after all routes are defined
scheduler = initialize_scheduler()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
