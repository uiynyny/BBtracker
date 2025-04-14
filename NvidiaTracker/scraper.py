import requests
from bs4 import BeautifulSoup
import logging
import time
from datetime import datetime
from models import ProductSnapshot
from app import db
import json
import random
import re
import requests
import trafilatura
import lxml.html

# Constants
PRODUCT_URL = "https://www.bestbuy.ca/en-ca/product/nvidia-geforce-rtx-5090-32gb-gddr7-video-card/18931348"
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.107 Safari/537.36'
]

def get_headers():
    """Generate random headers to avoid being blocked."""
    return {
        'User-Agent': random.choice(USER_AGENTS),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
    }

def extract_price(text):
    """Extract price from text."""
    if not text:
        return None
    
    # Try to find price pattern with $ sign
    price_pattern = r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)'
    match = re.search(price_pattern, text)
    
    if match:
        # Remove commas and convert to float
        return float(match.group(1).replace(',', ''))
    return None

def scrape_product():
    """Scrape the Best Buy product page for RTX 5090."""
    logging.info(f"Scraping product page: {PRODUCT_URL}")
    
    try:
        # Use requests to fetch the content
        response = requests.get(PRODUCT_URL, headers=get_headers(), timeout=10)
        response.raise_for_status()
        downloaded = response.text
        if not downloaded:
            logging.error("Failed to download the webpage content.")
            return None
            
        # Extract main content
        content = trafilatura.extract(downloaded, include_comments=False, include_tables=True, no_fallback=False)
        
        # Fallback to traditional scraping if trafilatura fails
        if not content:
            logging.warning("Trafilatura extraction failed, falling back to requests + BeautifulSoup")
            response = requests.get(PRODUCT_URL, headers=get_headers(), timeout=10)
            response.raise_for_status()
            content = response.text
            
        # Try to find product title from the page content
        product_title = "NVIDIA GeForce RTX 5090 32GB GDDR7 Video Card"
        
        # Extract price from content
        price_text = None
        price = None
        
        # Search for price in the content
        price_matches = re.findall(r'\$(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)', content if isinstance(content, str) else "")
        if price_matches:
            price_text = f"${price_matches[0]}"
            price = float(price_matches[0].replace(',', ''))
            logging.info(f"Found price: {price_text}")
        else:
            # Try to get price from metadata if available
            try:
                tree = lxml.html.fromstring(downloaded)
                meta_price = tree.xpath('//meta[@property="product:price:amount"]/@content')
                if meta_price:
                    price = float(meta_price[0])
                    price_text = f"${price:.2f}"
                    logging.info(f"Found price from metadata: {price_text}")
            except Exception as e:
                logging.error(f"Error extracting price from metadata: {str(e)}")
        
        # Default availability
        availability_text = "Unknown"
        available = False
        
        # Try to determine availability
        if "out of stock" in content.lower() if isinstance(content, str) else "":
            availability_text = "Out of Stock"
            available = False
        elif "sold out" in content.lower() if isinstance(content, str) else "":
            availability_text = "Sold Out"
            available = False
        elif "add to cart" in content.lower() if isinstance(content, str) else "":
            availability_text = "Available"
            available = True
        
        # Extract additional details (simplified for now)
        details = {
            "Product Name": "NVIDIA GeForce RTX 5090",
            "Memory": "32GB GDDR7",
            "Type": "Video Card"
        }
        
        # Create a snapshot with the scraped data
        snapshot = ProductSnapshot(
            timestamp=datetime.now().isoformat(),
            title=product_title,
            price=price,
            price_text=price_text,
            available=available,
            availability_text=availability_text,
            details=details,
            url=PRODUCT_URL
        )
        
        # Check for previous snapshots to detect changes
        from sqlalchemy import desc
        previous_snapshot = ProductSnapshot.query.order_by(desc(ProductSnapshot.timestamp)).first()
        
        # Always save the snapshot to have a history record
        db.session.add(snapshot)
        db.session.commit()
        
        if previous_snapshot:
            logging.info("Product data updated successfully")
        else:
            logging.info("Initial product data saved successfully")
            
        # Convert to dictionary suitable for JSON serialization
        return snapshot.to_dict()
        
    except requests.exceptions.RequestException as e:
        logging.error(f"Error fetching product page: {str(e)}")
        return None
    except Exception as e:
        logging.error(f"Error parsing product data: {str(e)}")
        return None

if __name__ == "__main__":
    # Test the scraper
    result = scrape_product()
    print(json.dumps(result, indent=2))
