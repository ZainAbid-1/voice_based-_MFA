from database import engine
from sqlalchemy import text

with engine.connect() as connection:
    print("Dropping old table...")
    connection.execute(text("DROP TABLE IF EXISTS users"))
    connection.commit()
    print("Database cleared!")