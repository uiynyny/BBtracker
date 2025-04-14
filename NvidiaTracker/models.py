from datetime import datetime
import logging
import difflib
import json

# Import db from a separate file to avoid circular imports
from database import db

class ProductSnapshot(db.Model):
    """Represents a snapshot of product information at a specific time."""
    
    __tablename__ = 'product_snapshots'
    
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    title = db.Column(db.String(255), nullable=False)
    price = db.Column(db.Float, nullable=True)
    price_text = db.Column(db.String(50), nullable=True)
    available = db.Column(db.Boolean, default=False, nullable=False)
    availability_text = db.Column(db.String(100), nullable=True)
    details = db.Column(db.JSON, nullable=True)
    url = db.Column(db.String(512), nullable=False)
    changes = db.Column(db.JSON, nullable=True)
    
    def __init__(self, timestamp, title, price, price_text, available, availability_text, details, url):
        if isinstance(timestamp, str):
            self.timestamp = datetime.fromisoformat(timestamp)
        else:
            self.timestamp = timestamp
        self.title = title
        self.price = price
        self.price_text = price_text
        self.available = available
        self.availability_text = availability_text
        self.details = details
        self.url = url
        self.changes = {}  # Track changes from previous snapshot
    
    def to_dict(self):
        """Convert instance to dictionary."""
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'title': self.title,
            'price': self.price,
            'price_text': self.price_text,
            'available': self.available,
            'availability_text': self.availability_text,
            'details': self.details,
            'url': self.url,
            'changes': self.changes
        }

def initialize_database():
    """Initialize the database for storing product snapshots."""
    logging.info("Initializing product database")
    db.create_all()
    return True

def update_database(snapshot):
    """
    Update the database with a new product snapshot.
    Returns True if significant changes were detected, False otherwise.
    """
    # Get the most recent snapshot from the database
    from sqlalchemy import desc
    previous_snapshot = ProductSnapshot.query.order_by(desc(ProductSnapshot.timestamp)).first()
    
    # First snapshot case
    if not previous_snapshot:
        snapshot.changes = {"initial": True}
        db.session.add(snapshot)
        db.session.commit()
        return True
    
    # Compare with the previous snapshot
    previous = previous_snapshot.to_dict()
    current = snapshot.to_dict()
    
    changes = detect_changes(previous, current)
    
    # If there are significant changes, add the snapshot
    if changes:
        snapshot.changes = changes
        db.session.add(snapshot)
        db.session.commit()
        logging.info(f"Detected changes: {changes}")
        return True
    
    return False

def detect_changes(previous, current):
    """
    Detect changes between the previous and current snapshots.
    Returns a dictionary of changes if significant changes are found,
    otherwise returns an empty dictionary.
    """
    changes = {}
    
    # Check price changes
    if previous.get('price') != current.get('price'):
        changes['price'] = {
            'old': previous.get('price'),
            'new': current.get('price')
        }
    
    # Check availability changes
    if previous.get('available') != current.get('available'):
        changes['available'] = {
            'old': previous.get('available'),
            'new': current.get('available')
        }
    
    # Check title changes
    if previous.get('title') != current.get('title'):
        changes['title'] = {
            'old': previous.get('title'),
            'new': current.get('title')
        }
    
    # Check availability text changes
    if previous.get('availability_text') != current.get('availability_text'):
        changes['availability_text'] = {
            'old': previous.get('availability_text'),
            'new': current.get('availability_text')
        }
    
    # Check details changes
    prev_details = previous.get('details', {})
    curr_details = current.get('details', {})
    
    detail_changes = {}
    for key in set(list(prev_details.keys()) + list(curr_details.keys())):
        prev_value = prev_details.get(key, None)
        curr_value = curr_details.get(key, None)
        
        if prev_value != curr_value:
            detail_changes[key] = {
                'old': prev_value,
                'new': curr_value
            }
    
    if detail_changes:
        changes['details'] = detail_changes
    
    return changes
