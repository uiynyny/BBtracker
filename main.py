from app import app
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)

# Set up application context for Flask-SQLAlchemy
with app.app_context():
    from database import db
    db.create_all()
    
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
