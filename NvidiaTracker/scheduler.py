from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging
from datetime import datetime
import random

def start_scheduler():
    """Start the background scheduler for periodic scraping."""
    from scraper import scrape_product
    
    scheduler = BackgroundScheduler()
    
    # Add randomization to avoid detection (between 5-10 minutes)
    def scrape_with_logging():
        logging.info(f"Scheduled scrape starting at {datetime.now().isoformat()}")
        from app import app
        
        # Run scraper within application context
        with app.app_context():
            result = scrape_product()
            if result:
                logging.info("Scheduled scrape completed successfully")
            else:
                logging.warning("Scheduled scrape failed or found no data")
    
    # Initial scrape when starting up
    scrape_with_logging()
    
    # Schedule periodic scrapes with randomized intervals
    scheduler.add_job(
        func=scrape_with_logging,
        trigger=IntervalTrigger(minutes=random.randint(5, 10)),
        id='scrape_job',
        name='Scrape Best Buy Product Page',
        replace_existing=True
    )
    
    scheduler.start()
    logging.info("Background scheduler started for periodic scraping")
    
    return scheduler
